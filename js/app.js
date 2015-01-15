var app = angular.module('id3ogramViewer', []);

function id3ogramController($scope) {

}

app.directive('id3ogram', ['$http', '$window', function($http,$window) {
    return {
        scope: {},
        restrict: 'AE',
        replace: 'true',
        templateUrl: 'id3ogramTemplate.html',
        link: function($scope, div, attrs) {
        	// app vars
            $scope.info = '';
            $scope.chromosomes = [];
            $scope.currentChromosome = null;
            var dataByCh = {};

            // static vis vars
            var rainbow = new Rainbow();
            var w = angular.element($window);
            var isFirefox = typeof InstallTrigger !== 'undefined';

            // current vis vars
            var vis = {}; // generic obj to hold the p and q arm arrays
            // max and min values for p and q arms for setting up the x axis domain
            var qmin = Infinity;
            var qmax = -Infinity;
            var pmin = Infinity;
            var pmax = -Infinity;
            // min and max density of bands for color gradient
            var minDensity = Infinity;
            var minDensity = -Infinity;
            var svg; // holds the actual ideogram
            // data for the background/outline arms
            var pArm = []
            var qArm = []
            var x; // x axis

            // init method to set up the data structures, and vis variables
            $scope.init = function() {
                  // link the select box to the chromosome numbers available
                  $scope.chromosomes = Object.keys(dataByCh);
                  // link the header to the current chromosome view
                  $scope.currentChromosome = $scope.chromosomes[0]

                  rainbow.setSpectrum('#dddddd','#000000');

                  // tooltip that holds the band label when it is visible
              	  div = d3.select("#vis").append("div")
              		.attr("class", "tooltip")
              		.style("opacity", 0)
                    .style("color","#3ca6dc");

                  svg = d3.select("#vis").append("svg")
                     .attr("height", 60);

                  $scope.resetCurrentVis();
              }

              // resetCurrentVis method calculates the data and calls methods to
              // draw the arms
              $scope.resetCurrentVis = function() {
                  var currentData = dataByCh[$scope.currentChromosome]

                  // reset arm arrays to calculate min/max for current chromosome
                  vis.q = [];
                  vis.p = [];

                  // separate chromosome data by arm
                  currentData.forEach(function(d) {
                      vis[d.arm].push(d);
                  });

                  qmin = d3.min(vis.q, function(d) { return d.genomic_coordinates.start });
                  qmax = d3.max(vis.q, function(d) { return d.genomic_coordinates.stop });
                  pmin = d3.min(vis.p, function(d) { return d.genomic_coordinates.start });
                  pmax = d3.max(vis.p, function(d) { return d.genomic_coordinates.stop });

                  // set up x axis, rangeRound used to avoid anti-aliasing issues
                  x = d3.scale.linear()
                    .rangeRound([0, document.getElementById('vis').offsetWidth]);
                  x.domain([0, qmax]);

                  // set values for drawing background and outline arm rects
                  pArm = [{start: 0, end: (pmax + (qmin-pmax)/2) }]
                  qArm = [{start: (pmax + (qmin-pmax)/2), end: qmax }]

                  minDensity = d3.min(currentData, function(d) { return d.density });
                  maxDensity = d3.max(currentData, function(d) { return d.density });

                  rainbow.setNumberRange(minDensity, maxDensity);

                  // makes the svg responsive
                  svg.attr("width", document.getElementById('vis').offsetWidth)

                  // remove all old elements and redraw
                  svg.selectAll("*").remove();
                  $scope.drawArm('p', pArm, vis.p);
                  $scope.drawArm('q', qArm, vis.q);
              };

              // drawArm method uses d3 to do the actual drawing
              $scope.drawArm = function(armID, armData, armBandData) {
                  var arm = svg.selectAll("."+armID+"Arm")
                      .data(armData)
                  .enter().append("g")
                      .attr("class", armID+"Arm");

                  // draws the background lightest gray arm rect
                  arm.append("rect")
                      .attr("rx", 5)
                      .attr("ry", 5)
                      .attr("width", function(d) { return x(d.end-d.start); })
                      .attr("height", 50)
                      .attr("transform", function(d) { return "translate(" + x(d.start) + ",0)" })
                      .attr("fill", "#fafafa");

                  var armBands = arm.selectAll(".armBand")
                      .data(armBandData);

                  // draws each band
                  armBands.enter().append("rect")
                      .attr("class", "armBand")
                      .attr("width", function(d) { return x(d.genomic_coordinates.stop-d.genomic_coordinates.start); })
                      .attr("height", 48)
                      .attr("transform", function(d) { return "translate(" + x(d.genomic_coordinates.start) + ",1)" })
                      .style("fill", function(d) { return "#"+rainbow.colorAt(d.density); })
            	      .on("mouseover", function(d) {
                          var leftOffset = svg[0][0].offsetLeft
                          var topOffset = svg[0][0].offsetTop
                          if(isFirefox) // firefox has an issue with the above declarations so this is a workaround
                          {
                              leftOffset = parseInt(svg[0][0].getBoundingClientRect().x+1)
                              topOffset = parseInt(svg[0][0].getBoundingClientRect().y)
                          }
                          this.style["fill"] = "#3ca6dc"
                          div.transition()
            	              .duration(200)
            	              .style("opacity", .9);
            	          div .html(d.band_label+"<br/>|")
            	              .style("left", (leftOffset + x(d.genomic_coordinates.start+(d.genomic_coordinates.stop-d.genomic_coordinates.start)/2)-2) + "px")
            	              .style("top", (topOffset-30) + "px");
            	      })
            	      .on("mouseout", function(d) {
                          this.style["fill"] = "#" + rainbow.colorAt(d.density);
            	          div.transition()
            	              .duration(500)
                              .style("opacity", 0);
            	      });

                  // draws the outline rect
                  arm.append("rect")
                      .attr("rx", 5)
                      .attr("ry", 5)
                      .attr("width", function(d) { return x(d.end-d.start); })
                      .attr("height", 50)
                      .attr("transform", function(d) { return "translate(" + x(d.start) + ",0)" })
                      .attr("stroke-width", 1)
                      .attr("stroke", "#111111")
                      .attr("fill", "none");
              }

              // update the vis on window resize for responsiveness
              w.bind('resize', function () {
                  $scope.resetCurrentVis();
              });

              // load the data and init
              $http.get(attrs.dataurl).
          	  success(function(data, status, headers, config) {
          	    // this callback will be called asynchronously
          	    // when the response is available
          		  $scope.info += 'dataset:' + data.dataset;
          		  $scope.info += '  ID:' + data.dataset_id;
          		  $scope.info += '  Build:' + data.genome_build;

                    data = data.results

                    // separate data by chromosomes
            		  data.forEach(function(d){
            			  var ch = parseInt(d.genomic_coordinates.chromosome);

                          if(!(ch in dataByCh))
                              dataByCh[ch] = [];

                          dataByCh[ch].push(d);
                    });
                    $scope.init();
          	  }).
          	  error(function(data, status, headers, config) {
          	    // called asynchronously if an error occurs
          	    // or server returns response with an error status.
          		  $scope.info = 'Failed to load data from SolveBio';
          	  });
        }
    };
}]);