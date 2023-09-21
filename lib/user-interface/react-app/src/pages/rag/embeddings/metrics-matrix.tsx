import React from "react";

export function MetricsMatrix(props: { values: number[][] }) {
  return (
    <table className="matrix-table">
      <tbody>
        {props.values.map((row, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {rowIndex === 0 && (
              <tr>
                <td>&nbsp;</td>
                {row.map((_, colIndex) => (
                  <td key={colIndex}>#{colIndex + 1}</td>
                ))}
              </tr>
            )}
            <tr>
              <td>#{rowIndex + 1}</td>
              {row.map((col, colIndex) => (
                <td key={colIndex}>
                  {col.toFixed(3).replace(/^-([.0]*)$/, "$1")}
                </td>
              ))}
            </tr>
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}
