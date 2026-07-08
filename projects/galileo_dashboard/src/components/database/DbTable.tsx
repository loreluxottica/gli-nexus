import type { DbColumn, DbRow } from "@/data/types";
import { fmtInt } from "@/lib/format";
import styles from "./Database.module.css";

/** Presentational source-records table for the current page slice. */
export function DbTable({ columns, rows }: { columns: DbColumn[]; rows: DbRow[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">Source database records</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.type === "int" ? styles.num : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {columns.map((c, ci) => {
                const v = row[ci];
                if (c.type === "int") {
                  return (
                    <td key={c.key} className={styles.num}>
                      {fmtInt(v as number)}
                    </td>
                  );
                }
                return <td key={c.key}>{(v as string) || "—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
