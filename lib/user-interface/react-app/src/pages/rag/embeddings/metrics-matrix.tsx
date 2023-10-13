import { Properties } from "csstype";
import React from "react";

const MIN_INTENSITY = 25;
const MAX_INTENSITY = 92;

function mapToIntensity(v: number, min: number, max: number): number {
  if (min > max) {
    // Negative
    return (
      MAX_INTENSITY -
      ((min - v) / (min - max)) * (MAX_INTENSITY - MIN_INTENSITY)
    );
  } else {
    // Positive
    return (
      MAX_INTENSITY -
      ((v - min) / (max - min)) * (MAX_INTENSITY - MIN_INTENSITY)
    );
  }
}

export function MetricsMatrix(props: {
  values: number[][];
  min: number;
  max: number;
  pinFirstInput?: boolean;
}) {
  const headerStyle: Properties = {
    //fontFamily: "courier",
    color: "darkgrey",
    textAlign: "center",
    fontWeight: "bold",
  };

  return (
    <table className="matrix-table">
      <tbody>
        {props.values.map((row, rowIndex) => {
          if (props.pinFirstInput && rowIndex > 0) return null;
          return (
            <React.Fragment key={rowIndex}>
              {rowIndex === 0 && (
                <tr>
                  <td>&nbsp;</td>
                  {row.map((_, colIndex) => {
                    if (props.pinFirstInput && colIndex == 0) return;

                    return (
                      <td key={colIndex} style={headerStyle}>
                        {colIndex + 1}
                      </td>
                    );
                  })}
                </tr>
              )}
              <tr>
                <td style={{ ...headerStyle, width: "50px" }}>
                  {rowIndex + 1}
                </td>
                {row.map((col, colIndex) => {
                  if (props.pinFirstInput && colIndex == 0) return null;
                  if (!props.pinFirstInput && rowIndex > colIndex)
                    return <td key={colIndex}></td>;

                  let fgColor = "black";
                  const v = col.toFixed(3);
                  const intensity = mapToIntensity(col, props.min, props.max);
                  if (intensity < 50) {
                    fgColor = "white";
                  }
                  return (
                    <td
                      key={colIndex}
                      style={{
                        backgroundColor: `hsl(275, 100%, ${intensity}%)`,
                        color: fgColor,
                      }}
                    >
                      {v.replace(/^-([.0]*)$/, "$1")}
                      <div
                        style={{
                          width: `${100 - intensity}%`,
                          backgroundColor: fgColor,
                          marginTop: "6px",
                          height: "3px",
                          position: "relative",
                          zIndex: "10",
                        }}
                      >
                        &nbsp;
                      </div>
                    </td>
                  );
                })}
              </tr>
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
