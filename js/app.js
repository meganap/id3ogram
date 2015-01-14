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
            var info = '';
            var chromosomes = [];
            var currentChromosome = null;
            var dataByCh = {};

            // static vis vars
            var rainbow = new Rainbow();
            var w = angular.element($window);

            // current vis vars
            var vis = {};
            var aspect;
            var container;
            var q = [];
            var p = [];
            var qmin = Infinity;
            var qmax = -Infinity;
            var pmin = Infinity;
            var pmax = -Infinity;
            var minDensity = Infinity;
            var minDensity = -Infinity;
            var svg;
            var pArm = []
            var qArm = []
            var x;

              $scope.init = function() {
                  $scope.chromosomes = Object.keys(dataByCh);
                  $scope.currentChromosome = $scope.chromosomes[0]

                  rainbow.setSpectrum('#dddddd','#000000');

              	  div = d3.select("#vis").append("div")
              		.attr("class", "tooltip")
              		.style("opacity", 0);

                  svg = d3.select("#vis").append("svg")
                      .attr("width", document.getElementById('vis').offsetWidth)
                      .attr("height", 60)
                      .attr("perserveAspectRatio", "xMinYMid");

                  aspect = svg.width / svg.height;
                  container = document.getElementById('vis');

                  // $(window).on("resize", function() {
                  //     var targetWidth = container.width();
                  //     svg.attr("width", targetWidth);
                  //     svg.attr("height", Math.round(targetWidth / aspect));
                  // }).trigger("resize");

                  $scope.resetCurrentVis();
              }

              $scope.resetCurrentVis = function() {
                  var currentData = dataByCh[$scope.currentChromosome]

                  // reset vars
                  vis.q = [];
                  vis.p = [];

                  currentData.forEach(function(d) {
                      vis[d.arm].push(d);
                  });

                  qmin = d3.min(vis.q, function(d) { return d.genomic_coordinates.start });
                  qmax = d3.max(vis.q, function(d) { return d.genomic_coordinates.stop });
                  pmin = d3.min(vis.p, function(d) { return d.genomic_coordinates.start });
                  pmax = d3.max(vis.p, function(d) { return d.genomic_coordinates.stop });

                  x = d3.scale.linear()
                    .rangeRound([0, document.getElementById('vis').offsetWidth]);
                  x.domain([0, qmax]);

                  pArm = []
                  pArm.push({start: 0, end: (pmax + (qmin-pmax)/2) })

                  qArm = []
                  qArm.push({start: (pmax + (qmin-pmax)/2), end: qmax })

                  minDensity = d3.min(currentData, function(d) { return d.density });
                  maxDensity = d3.max(currentData, function(d) { return d.density });

                  rainbow.setNumberRange(minDensity, maxDensity);

                  svg.selectAll("*").remove();
                  $scope.drawArm('p', pArm, vis.p);
                  $scope.drawArm('q', qArm, vis.q);
              };

              $scope.drawArm = function(armID, armData, armBandData) {
                  var arm = svg.selectAll("."+armID+"Arm")
                      .data(armData)
                  .enter().append("g")
                      .attr("class", armID+"Arm");

                  arm.append("rect")
                      .attr("rx", 5)
                      .attr("ry", 5)
                      .attr("width", function(d) { return x(d.end-d.start); })
                      .attr("height", 50)
                      .attr("transform", function(d) { return "translate(" + x(d.start) + ",0)" })
                      .attr("fill", "#fafafa");

                  var armBands = arm.selectAll(".armBand")
                      .data(armBandData);

                  armBands.enter().append("rect")
                      .attr("class", "armBand")
                      .attr("width", function(d) { return x(d.genomic_coordinates.stop-d.genomic_coordinates.start); })
                      .attr("height", 48)
                      .attr("transform", function(d) { return "translate(" + x(d.genomic_coordinates.start) + ",1)" })
                      .style("fill", function(d) { return "#"+rainbow.colorAt(d.density); })
            	      .on("mouseover", function(d) {
                          this.style["fill"] = "#3ca6dc"
                          div.transition()
            	              .duration(200)
            	              .style("opacity", .9);
            	          div .html(d.band_label+"<br/>|")
            	              .style("left", (svg[0][0].offsetLeft + x(d.genomic_coordinates.start+(d.genomic_coordinates.stop-d.genomic_coordinates.start)/2)-2) + "px")
            	              .style("top", svg[0][0].offsetTop-30 + "px");
            	      })
            	      .on("mouseout", function(d) {
                          this.style["fill"] = "#" + rainbow.colorAt(d.density);
            	          div.transition()
            	              .duration(500)
            	              .style("opacity", 0)
                          div .html("")
                              .style("left", (0) + "px")
                              .style("top", (0) + "px");
            	      });

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

              // getWindowDimensions = function () {
              //     return {
              //         'h': w.getOffsetHeight,
              //         'w': w.getOffsetWidth
              //     };
              // };
              // $watch(getWindowDimensions, function (newValue, oldValue) {
              //     windowHeight = newValue.h;
              //     windowWidth = newValue.w;
              //
              //     console.log('do resize stuff here')
              //
              // }, true);
              //
              // $window.bind('resize', function () {
              //     $apply();
              // });

              $http.get(attrs.dataurl).
          	  success(function(data, status, headers, config) {
          	    // this callback will be called asynchronously
          	    // when the response is available
          		  info += 'dataset:' + data.dataset;
          		  info += '  ID:' + data.dataset_id;
          		  info += '  Build:' + data.genome_build;

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
          		  info = 'Failed to load data from SolveBio';
          	  });
        }
    };
}]);