import sys
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import Mock, patch

import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "projects"))
from kelly_dashboard import data_loader, holidays_loader


def forecast_rows(value=0.2):
    return pd.DataFrame({
        "Date": ["2024-01-01", "2024-01-02"],
        "ID": ["Area A", "Area A"],
        "Actual": [0.1, 0.2],
        "Forecast": [value, value],
        "Forecast_Vintage": ["2023-12-31", "2023-12-31"],
    })


def holiday_client(**kwargs):
    return Mock(RequestException=requests.RequestException, get=Mock(**kwargs))


class ForecastCacheTests(unittest.TestCase):
    def setUp(self):
        cache = patch.dict(data_loader._cache, {}, clear=True)
        cache.start()
        self.addCleanup(cache.stop)

    def test_same_day_reuses_enriched_frame(self):
        with patch.object(data_loader, "_load_delta", return_value=forecast_rows()) as load:
            first = data_loader.load_data("atlanta")
            self.assertIs(data_loader.load_data("atlanta"), first)
        load.assert_called_once_with("atlanta")
        self.assertEqual(first["Year"].tolist(), [2024, 2024])
        self.assertEqual(first["Week"].tolist(), [1, 1])
        self.assertEqual(first["Working"].tolist(), [True, True])
        self.assertEqual(first["Actual"].tolist(), [0.1, 0.2])
        self.assertEqual(first["Forecast"].tolist(), [0.2, 0.2])

    def test_refresh_replaces_old_frames_without_accumulating_days(self):
        with patch.object(data_loader, "_load_delta", side_effect=lambda _: forecast_rows()):
            for _ in range(10):
                for warehouse in data_loader.WAREHOUSE_MAP:
                    data_loader._cache[warehouse] = ("2000-01-01", forecast_rows(0.8))
                    fresh = data_loader.load_data(warehouse)
                    self.assertEqual(fresh["Forecast"].tolist(), [0.2, 0.2])
                self.assertEqual(set(data_loader._cache), set(data_loader.WAREHOUSE_MAP))
                self.assertEqual(len(data_loader._cache), len(data_loader.WAREHOUSE_MAP))

    def test_failed_refresh_is_unavailable_and_retryable(self):
        yesterday = forecast_rows(0.8)
        data_loader._cache["atlanta"] = ("2000-01-01", yesterday)
        with patch.object(data_loader, "_load_delta", side_effect=[None, forecast_rows()]):
            self.assertIsNone(data_loader.load_data("atlanta"))
            fresh = data_loader.load_data("atlanta")
        self.assertIsNot(fresh, yesterday)
        self.assertIs(data_loader._cache["atlanta"][1], fresh)
        self.assertEqual(len(data_loader._cache), 1)

    def test_initial_failure_does_not_create_a_cache_entry(self):
        with patch.object(data_loader, "_load_delta", return_value=None):
            self.assertIsNone(data_loader.load_data("atlanta"))
        self.assertEqual(data_loader._cache, {})

    def test_concurrent_requests_share_one_load(self):
        started, release = threading.Event(), threading.Event()

        def query(_):
            started.set()
            if not release.wait(5):
                raise TimeoutError("Test did not release the forecast load")
            return forecast_rows()

        with patch.object(data_loader, "_load_delta", side_effect=query) as load:
            with ThreadPoolExecutor(max_workers=4) as pool:
                first = pool.submit(data_loader.load_data, "atlanta")
                try:
                    self.assertTrue(started.wait(5))
                    others = [pool.submit(data_loader.load_data, "atlanta") for _ in range(3)]
                finally:
                    release.set()
                frame = first.result(timeout=5)
                for future in others:
                    self.assertIs(future.result(timeout=5), frame)
        load.assert_called_once_with("atlanta")

    def test_one_plant_does_not_block_another(self):
        started, release = threading.Event(), threading.Event()

        def query(warehouse):
            if warehouse == "atlanta":
                started.set()
                if not release.wait(5):
                    raise TimeoutError("Test did not release Atlanta")
            return forecast_rows()

        with patch.object(data_loader, "_load_delta", side_effect=query):
            with ThreadPoolExecutor(max_workers=2) as pool:
                atlanta = pool.submit(data_loader.load_data, "atlanta")
                try:
                    self.assertTrue(started.wait(5))
                    columbus = pool.submit(data_loader.load_data, "columbus")
                    self.assertIsNotNone(columbus.result(timeout=2))
                finally:
                    release.set()
                self.assertIsNotNone(atlanta.result(timeout=5))

    def test_concurrent_failure_is_shared_but_later_requests_can_retry(self):
        barrier = threading.Barrier(4)
        lock = threading.Lock()

        class CoordinatedLock:
            def __enter__(self):
                barrier.wait(timeout=5)
                lock.acquire()

            def __exit__(self, *args):
                lock.release()

        with (
            patch.dict(data_loader._locks, {"atlanta": CoordinatedLock()}),
            patch.object(data_loader, "_load_delta", return_value=None) as load,
        ):
            with ThreadPoolExecutor(max_workers=4) as pool:
                results = list(pool.map(data_loader.load_data, ["atlanta"] * 4))
        self.assertEqual(results, [None] * 4)
        load.assert_called_once_with("atlanta")
        with patch.object(data_loader, "_load_delta", return_value=forecast_rows()):
            self.assertIsNotNone(data_loader.load_data("atlanta"))

    def test_unknown_plant_is_logged_without_allocating_cache(self):
        with self.assertLogs(data_loader._log, level="WARNING"):
            self.assertIsNone(data_loader.load_data("unknown"))
        self.assertEqual(data_loader._cache, {})


class HolidayCacheTests(unittest.TestCase):
    def setUp(self):
        for target in (holidays_loader._cache, holidays_loader._retry_after):
            cache = patch.dict(target, {}, clear=True)
            cache.start()
            self.addCleanup(cache.stop)

    def test_successful_empty_calendar_is_cached(self):
        response = Mock()
        response.json.return_value = []
        client = holiday_client(return_value=response)
        with patch.object(holidays_loader, "requests", client):
            self.assertEqual(holidays_loader._fetch_year("US", 2026), [])
            self.assertEqual(holidays_loader._fetch_year("US", 2026), [])
        client.get.assert_called_once()
        self.assertIn(("US", 2026), holidays_loader._cache)
        self.assertEqual(holidays_loader._retry_after, {})

    def test_transient_failure_recovers_after_short_backoff(self):
        response = Mock()
        response.json.return_value = [{"date": "2026-12-25", "name": "Christmas"}]
        client = holiday_client(side_effect=[requests.Timeout("offline"), response])
        with (
            patch.object(holidays_loader, "time") as clock,
            patch.object(holidays_loader, "requests", client),
        ):
            clock.monotonic.return_value = 100
            with self.assertLogs(holidays_loader._log, level="WARNING"):
                self.assertEqual(holidays_loader._fetch_year("US", 2026), [])
            self.assertNotIn(("US", 2026), holidays_loader._cache)
            clock.monotonic.return_value = 129
            self.assertEqual(holidays_loader._fetch_year("US", 2026), [])
            self.assertEqual(client.get.call_count, 1)
            clock.monotonic.return_value = 130
            self.assertEqual(holidays_loader._fetch_year("US", 2026), response.json.return_value)
            self.assertEqual(client.get.call_count, 2)
        self.assertEqual(holidays_loader._retry_after, {})

    def test_malformed_responses_are_not_cached_as_calendars(self):
        for payload in ({"error": "unavailable"}, [None]):
            with self.subTest(payload=payload):
                holidays_loader._retry_after.clear()
                response = Mock()
                response.json.return_value = payload
                with (
                    patch.object(holidays_loader, "requests", holiday_client(return_value=response)),
                    self.assertLogs(holidays_loader._log, level="WARNING"),
                ):
                    self.assertEqual(holidays_loader._fetch_year("IT", 2026), [])
                self.assertNotIn(("IT", 2026), holidays_loader._cache)

    def test_unexpected_programming_errors_are_not_hidden(self):
        client = holiday_client(side_effect=RuntimeError("bug"))
        with patch.object(holidays_loader, "requests", client):
            with self.assertRaisesRegex(RuntimeError, "bug"):
                holidays_loader._fetch_year("US", 2026)

    def test_upcoming_holiday_sorting_and_limit_are_preserved(self):
        today = pd.Timestamp.today().normalize()
        dates = [today + pd.Timedelta(days=day) for day in range(9, 0, -1)]

        def calendar(country, year):
            self.assertEqual(country, "IT")
            return [
                {"date": str(day.date()), "localName": "Local", "name": "Holiday"}
                for day in dates if day.year == year
            ]

        with patch.object(holidays_loader, "_fetch_year", side_effect=calendar):
            result = holidays_loader.get_upcoming_holidays("sedico")
        self.assertEqual(len(result), 8)
        self.assertEqual([h["date"] for h in result], sorted(dates)[:8])
        self.assertTrue(all(h["country"] == "IT" and h["name"] == "Local" for h in result))


if __name__ == "__main__":
    unittest.main()
