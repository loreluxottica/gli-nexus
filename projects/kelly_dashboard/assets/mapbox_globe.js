// EL "Eye Tech Room" style spinning Mapbox globe for the Kelly landing page.
window.dash_clientside = window.dash_clientside || {};

window.dash_clientside.mapboxGlobe = {
    init: function (cfg) {
        var NO = (window.dash_clientside && window.dash_clientside.no_update) || undefined;
        if (!cfg || !window.mapboxgl) { return NO; }

        var el = document.getElementById("mapbox-globe");
        if (!el) { return NO; }
        if (el._inited) { return NO; }      // run once
        el._inited = true;

        mapboxgl.accessToken = cfg.token;

        var map = new mapboxgl.Map({
            container: "mapbox-globe",
            style: cfg.style,
            projection: "globe",
            center: [10, 25],
            zoom: 1.55,
            attributionControl: false,
            logoPosition: "bottom-left",
        });

        // Dark space + stars (matches the monitors' setFog)
        map.on("style.load", function () {
            map.setFog({
                "color": "rgba(245, 246, 250, 0.46)",       // lower atmosphere — soft white
                "high-color": "rgba(255, 255, 255, 0.34)",   // white halo around the globe
                "horizon-blend": 0.01,              // wider atmospheric glow
                "space-color": "rgb(4,5,8)",        // dark space
                "star-intensity": 0.45,
            });
        });

        // Warehouse markers → click navigates to forecast page
        (cfg.warehouses || []).forEach(function (w) {
            // Wrapper is the element Mapbox positions every frame — keep it
            // free of CSS transitions/transforms so markers track the globe.
            var d = document.createElement("div");
            d.className = "wh-marker";
            var dot = document.createElement("div");
            dot.className = "wh-marker-dot";
            d.appendChild(dot);

            var popup = new mapboxgl.Popup({ offset: 14, closeButton: false, closeOnClick: false });
            popup.setText(w.city);
            var marker = new mapboxgl.Marker(d).setLngLat([w.lon, w.lat]).addTo(map);

            d.addEventListener("mouseenter", function () { popup.setLngLat([w.lon, w.lat]).addTo(map); });
            d.addEventListener("mouseleave", function () { popup.remove(); });
            d.addEventListener("click", function (e) {
                e.stopPropagation();
                window.location.href = (cfg.prefix || "/") + "forecast/" + w.id;
            });
        });

        // ── Auto-rotation (Mapbox "spinning globe" pattern) ──
        var spinning = true;
        var userInteracting = false;
        var degreesPerStep = 2;

        function spin() {
            if (!spinning || userInteracting) { return; }
            var c = map.getCenter();
            c.lng -= degreesPerStep;
            map.easeTo({ center: c, duration: 1000, easing: function (t) { return t; } });
        }

        map.on("moveend", spin);
        ["mousedown", "touchstart", "dragstart"].forEach(function (ev) {
            map.on(ev, function () { userInteracting = true; });
        });
        ["mouseup", "touchend", "dragend"].forEach(function (ev) {
            map.on(ev, function () { userInteracting = false; spin(); });
        });
        map.on("load", spin);

        return "";
    },
};
