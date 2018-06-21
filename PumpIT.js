/**
 * PumpIT - The Pump Irrigation Tool
 *
 * result of the 2018 GEE User Summit Hackathon
 * created by: Ankan De, Jonna van Opstal, Kersten Clauss
 *
 * live at: https://kersten.users.earthengine.app/view/pumpit
 */

// Center the region of interest.
var center = {lon: 87.822, lat: 22.448, zoom: 9};

// limit study area to West Bengal
var roi = ee.Geometry.Polygon([[84.814453125,20.981956742832327],
[90.24169921875,20.981956742832327],
[90.24169921875,26.82407078047018],
[84.814453125,26.82407078047018],
[84.814453125,20.981956742832327]])

// Create two maps.
var leftMap = ui.Map(center);
var rightMap = ui.Map(center);

// Remove UI controls from both maps, but leave zoom control on the left map.
leftMap.setControlVisibility(false);
rightMap.setControlVisibility(false);
leftMap.setControlVisibility({zoomControl: true});

// Link them together.
var linker = new ui.Map.Linker([leftMap, rightMap]);

// Create a split panel with the two maps.
var splitPanel = ui.SplitPanel({
  firstPanel: leftMap,
  secondPanel: rightMap,
  orientation: 'horizontal',
  wipe: true
});



// import Landsat data - Landsat5 for pre-installation and Landsat8 for post-installation
var lt5 = ee.ImageCollection("LANDSAT/LT05/C01/T1_SR")
  .filterBounds(roi)
var lt8 = ee.ImageCollection("LANDSAT/LC08/C01/T1_SR")
  .filterBounds(roi)
// add NDVI bands
var addNDVILT5 = function(image) {
  var ndvi = image.normalizedDifference(['B4', 'B3']).rename('NDVI');
  return image.addBands(ndvi);
};

var addNDVILT8 = function(image) {
  var ndvi = image.normalizedDifference(['B5', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
};

// NDVI ImageCollections
var lt5_ndvi = lt5.map(addNDVILT5).filterDate("2010-01-01", "2013-01-01").select("NDVI")
var lt8_ndvi = lt8.map(addNDVILT8).filterDate("2013-01-01", "2016-01-01").select("NDVI")

//filter by month and calculate mean for monthly time series
var months=ee.List.sequence(1,12)

var lt5_monthly =  ee.ImageCollection(months.map(function(m) {
  return lt5_ndvi.filter(ee.Filter.calendarRange({
      start: m,
      field: 'month'
  })).mean().set('month', m)
}));

var lt8_monthly =  ee.ImageCollection(months.map(function(m) {
  return lt8_ndvi.filter(ee.Filter.calendarRange({
      start: m,
      field: 'month'
  })).mean().set('month', m)
}));


// display NDVI medians pre- and post- pump-install
// var colorbrewer = require('users/gena/packages:colorbrewer')
var spectralPalette = ["D7191C", "FDAE61", "FFFFBF", "ABDDA4", "2B83BA"]  // spectral colormap
var ndviParams = {min: -0.3, max: 1, palette: spectralPalette};

leftMap.addLayer(lt5_ndvi.median(), ndviParams, "pre-install NDVI")
rightMap.addLayer(lt8_ndvi.median(), ndviParams, "post-install NDVI")

// import Irrigation pumps
// var pumps = ee.FeatureCollection("ft:1iDdxhm4sjAmDVMT2vBeMjM5AJWpItl3N9vsfovXq", "geometry")
var pumps = ee.FeatureCollection("users/thewatercentre/WB_Data")
var pumps_buffered = pumps.map(function(feature){
  return feature.buffer(100)
})

// display pump locations
// var dots = ui.Map.Layer(pumps_buffered, {color: 'FF0000'}, "Pumps");
leftMap.addLayer(pumps, {color: '0000FF'}, "Pumps")
rightMap.addLayer(pumps, {color: '0000FF'}, "Pumps")


// callback functions for each side of the map on click
rightMap.onClick(function(coords) {
  // clear existing charts
  chartPanel.clear()
  compChart.clear()

  // Add a red dot for the point clicked on.
  var point = ee.Geometry.Point(coords.lon, coords.lat);
  // var dot = ui.Map.Layer(point, {color: 'FF0000'});
  // rightMap.layers().set(1, dot);

  // composite chart showing monthly averaves pre and post-install
  // extract array at point
  var lt5_comp_chart = ui.Chart.image.series(
    lt5_monthly,
    pumps.filterBounds(point.buffer(300)).first().geometry(),
    ee.Reducer.mean(), 200, "month")

  lt5_comp_chart.setOptions({
    title: 'Monthly mean pre-install',
    vAxis: {title: 'NDVI'},
    hAxis: {gridlines: {count: 0}, ticks: [3, 6, 11]}
  });

  chartPanel.widgets().set(2, lt5_comp_chart);

  var lt8_comp_chart = ui.Chart.image.series(
    lt8_monthly,
    pumps.filterBounds(point.buffer(300)).first().geometry(),
    ee.Reducer.mean(), 200, "month")

  lt8_comp_chart.setOptions({
    title: 'Monthly mean post-install',
    vAxis: {title: 'NDVI'},
    hAxis: {gridlines: {count: 0}, ticks: [3, 6, 11]}
  });

  chartPanel.widgets().set(3, lt8_comp_chart);

    // Create a pre-install chart.
  var lt5_chart = ui.Chart.image.series(lt5_ndvi,
    pumps.filterBounds(point.buffer(300)).first().geometry(),  // buffer the clicked point to intersect with pumps
    ee.Reducer.mean(), 200);
    // print(pumps.filterBounds(point.buffer(50))) // debugging: print the selected
  lt5_chart.setOptions({
    title: 'Pre-Install NDVI',
    vAxis: {title: 'VH'},
    hAxis: {title: 'date', format: 'MM-yy', gridlines: {count: 7}},
  });
  chartPanel.widgets().set(4, lt5_chart);

  // Create a post-install chart.
  var lt8_chart = ui.Chart.image.series(lt8_ndvi,
  pumps.filterBounds(point.buffer(300)).first().geometry(),
  ee.Reducer.mean(), 200);
  lt8_chart.setOptions({
    title: 'Post-Install NDVI',
    vAxis: {title: 'NDVI'},
    hAxis: {title: 'date', format: 'MM-yy', gridlines: {count: 7}},
  });
  chartPanel.widgets().set(5, lt8_chart);
});

// left map side
leftMap.onClick(function(coords) {
  // clear existing charts
  chartPanel.clear()
  compChart.clear()

  // Add a red dot for the point clicked on.
  var point = ee.Geometry.Point(coords.lon, coords.lat);
  // var dot = ui.Map.Layer(point, {color: 'FF0000'});
  // rightMap.layers().set(1, dot);

  // composite chart showing monthly averaves pre and post-install
  // extract array at point
  var lt5_comp_chart = ui.Chart.image.series(
    lt5_monthly,
    pumps.filterBounds(point.buffer(300)).first().geometry(),
    ee.Reducer.mean(), 200, "month")

  lt5_comp_chart.setOptions({
    title: 'Monthly mean pre-install',
    vAxis: {title: 'NDVI'},
    hAxis: {gridlines: {count: 0}, ticks: [3, 6, 11]}
  });

  chartPanel.widgets().set(2, lt5_comp_chart);

  var lt8_comp_chart = ui.Chart.image.series(
    lt8_monthly,
    pumps.filterBounds(point.buffer(300)).first().geometry(),
    ee.Reducer.mean(), 200, "month")

  lt8_comp_chart.setOptions({
    title: 'Monthly mean post-install',
    vAxis: {title: 'NDVI'},
    hAxis: {gridlines: {count: 0}, ticks: [3, 6, 11]}
  });

  chartPanel.widgets().set(3, lt8_comp_chart);

    // Create a pre-install chart.
  var lt5_chart = ui.Chart.image.series(lt5_ndvi,
    pumps.filterBounds(point.buffer(300)).first().geometry(),  // buffer the clicked point to intersect with pumps
    ee.Reducer.mean(), 200);
    // print(pumps.filterBounds(point.buffer(50))) // debugging: print the selected
  lt5_chart.setOptions({
    title: 'Pre-Install NDVI',
    vAxis: {title: 'VH'},
    hAxis: {title: 'date', format: 'MM-yy', gridlines: {count: 7}},
  });
  chartPanel.widgets().set(4, lt5_chart);

  // Create a post-install chart.
  var lt8_chart = ui.Chart.image.series(lt8_ndvi,
  pumps.filterBounds(point.buffer(300)).first().geometry(),
  ee.Reducer.mean(), 200);
  lt8_chart.setOptions({
    title: 'Post-Install NDVI',
    vAxis: {title: 'NDVI'},
    hAxis: {title: 'date', format: 'MM-yy', gridlines: {count: 7}},
  });
  chartPanel.widgets().set(5, lt8_chart);
});


// Panel for outputting the NDVI trends
var panel = ui.Panel({style: {width: '300px'}});
panel.add(ui.Label('PumpIT - Pump Impact Tool', {fontSize: '20px'}))
// panel.add(ui.Label('Pump Irrigation Tool', {fontSize: '10px'}))
ui.root.insert(0, panel);
var instructions = ui.Label(
  "Click a pump location to see the impact on agricultural productivity:"
  + " compare before and after the pump install.");
panel.add(instructions);
var compChart = ui.Panel({style: {stretch: "vertical"}});
panel.add(compChart)
var chartPanel = ui.Panel({style: {stretch: "horizontal"}});
panel.add(chartPanel);


// Remove the default map from the root panel.
ui.root.clear();

// Add our split panel to the root panel.
ui.root.add(splitPanel);
ui.root.add(panel)

// Set crosshair cursor for clicking on Map
leftMap.style().set("cursor","crosshair");
rightMap.style().set("cursor","crosshair");
