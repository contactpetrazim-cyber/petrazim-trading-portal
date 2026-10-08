import { useState } from 'react';

// Adjustable vertical (price) axis — by direct request ("Can you make
// the vertical axis adjustable for all charts portal wide ... on
// charts, snapshots and approval charts"). CandleChart's own y-axis
// has always been auto-fit only (computeChartRange: every visible
// candle/zone/line/marker price, plus an 8% margin) with no manual
// override anywhere — this is the shared zoom state + math every
// chart view wires in on top of that, same spirit as the X-axis's own
// existing zoomIn/zoomOut buttons (PositionOnChartModal/ChartOPage/
// MT5Page already have those; this is the missing Y-axis counterpart).
//
// `yZoom` > 1 narrows the visible price range (zoomed in, candles
// taller); < 1 widens it (zoomed out, more headroom above/below).
// Applied around the auto-fit range's own CENTER, not anchored to one
// edge, so zooming in/out doesn't drift the chart up or down.
const MIN_Y_ZOOM = 0.25;
const MAX_Y_ZOOM = 6;

export function useYAxisZoom() {
  const [yZoom, setYZoom] = useState(1);
  function zoomInY() {
    setYZoom((z) => Math.min(MAX_Y_ZOOM, z * 1.3));
  }
  function zoomOutY() {
    setYZoom((z) => Math.max(MIN_Y_ZOOM, z / 1.3));
  }
  function resetY() {
    setYZoom(1);
  }
  return { yZoom, zoomInY, zoomOutY, resetY };
}

/** Applies a zoom factor to an auto-fit {yTop, yBottom} range, around
 * its own center — pass the result as CandleChart's new `yRange` prop
 * (or use directly for a custom non-CandleChart renderer, e.g.
 * TradeSnapshotModal's own inline SVG). zoom === 1 returns the input
 * unchanged (the original auto-fit behavior, byte-for-byte). */
export function applyYZoom(yTop: number, yBottom: number, zoom: number): { yTop: number; yBottom: number } {
  if (zoom === 1) return { yTop, yBottom };
  const center = (yTop + yBottom) / 2;
  const halfRange = (yTop - yBottom) / 2 / zoom;
  return { yTop: center + halfRange, yBottom: center - halfRange };
}
