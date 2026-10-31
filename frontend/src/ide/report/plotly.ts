// Only the chart types the reports draw. The full Plotly bundle also carries maps, geo, finance, polar,
// sankey and more.
import Plotly from "plotly.js/lib/core";
import bar from "plotly.js/lib/bar";
import candlestick from "plotly.js/lib/candlestick";
import heatmap from "plotly.js/lib/heatmap";
import histogram from "plotly.js/lib/histogram";
import scatter3d from "plotly.js/lib/scatter3d";
import type * as PlotlyApi from "plotly.js";

Plotly.register([bar, candlestick, heatmap, histogram, scatter3d]);

export default Plotly as typeof PlotlyApi;
