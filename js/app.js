var app = angular.module('id3ogramViewer', []);

app.directive('id3ogram', ['$http', '$window', function ($http, $window) {
    return {
        scope: {},
        restrict: 'AE',
        replace: 'true',
        templateUrl: 'id3ogramTemplate.html',
        link: function ($scope, div, attrs) {
            // app vars
            $scope.info = '';
            $scope.chromosomes = [];
            $scope.currentChromosome = null;
            $scope.currentBandData = null;

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
            var pArm = [];
            var qArm = [];
            var centromereLength = 0;
            var x; // x axis

            // init method to set up the data structures, and vis variables
            $scope.init = function () {
                // set up list of chromosomes
                for (var i = 1; i < 23; i++)
                    $scope.chromosomes.push(i);

                $scope.chromosomes.push('X');
                $scope.chromosomes.push('Y');

                // link the header to the current chromosome view
                $scope.currentChromosome = $scope.chromosomes[0];

                rainbow.setSpectrum('#f3f3f3','#555555');

                // tooltip that holds the band label when it is visible
              	div = d3.select("#vis").append("div")
              		.attr("class", "tooltip")
              		.style("opacity", 0)
                    .style("color","#3ca6dc");

                svg = d3.select("#vis").append("svg")
                    .attr("height", 40);

                $scope.getBandData();
            }

            $scope.getBandData = function () {
                svg.style("opacity", .1)
                data = {
                    'fields': [
                        "arm",
                        "band_label",
                        "genomic_coordinates.start",
                        "genomic_coordinates.stop",
                        "density"
                    ],
                    'filters': [{and: [
                        ["genomic_coordinates.chromosome", $scope.currentChromosome],
                        ["band_level", "550"]
                    ]}]
                }

                $http.post(attrs.dataurl, data)
                    .success(function (data, status, headers, config) {
                        // this callback will be called asynchronously
                        // when the response is available
                    	$scope.info = 'dataset:' + data.dataset;
                    	$scope.info += '  ID:' + data.dataset_id;
                    	$scope.info += '  Build:' + data.genome_build;

                        $scope.currentBandData = data.results
                        $scope.resetCurrentVis();
                    })
                    .error(function (data, status, headers, config) {
                        // called asynchronously if an error occurs
                        // or server returns response with an error status.
                        $scope.info = 'Failed to load data from SolveBio';
                    });
            }

            // resetCurrentVis method calculates the data and calls methods to
            // draw the arms
            $scope.resetCurrentVis = function () {
                // reset arm arrays to calculate min/max for current chromosome
                vis.q = [];
                vis.p = [];

                // separate chromosome data by arm
                $scope.currentBandData.forEach(function (d) {
                    vis[d.arm].push(d);
                });

                qmin = d3.min(vis.q, function (d) { return d.genomic_coordinates.start });
                qmax = d3.max(vis.q, function (d) { return d.genomic_coordinates.stop });
                pmin = d3.min(vis.p, function (d) { return d.genomic_coordinates.start });
                pmax = d3.max(vis.p, function (d) { return d.genomic_coordinates.stop });

                centromereLength = (qmax-pmin) * .05;

                // set up x axis, rangeRound used to avoid anti-aliasing issues
                x = d3.scale.linear()
                    .rangeRound([0, document.getElementById('vis').offsetWidth]);
                x.domain([pmin, qmax+centromereLength]);

                // set values for drawing background and outline arm rects
                pArm = [{start: pmin, end: pmax }];
                qArm = [{start: qmin, end: qmax }];

                minDensity = d3.min($scope.currentBandData, function (d) { return d.density });
                maxDensity = d3.max($scope.currentBandData, function (d) { return d.density });

                rainbow.setNumberRange(minDensity, maxDensity);

                // makes the svg responsive
                svg.attr("width", document.getElementById('vis').offsetWidth)

                // remove all old elements and redraw
                svg.selectAll("*").remove();

                $scope.drawArm('p', pArm, vis.p, 0);
                // 32 for height to account for 2px stroke on outlines
                $scope.drawCentromere(x(pmax), x(centromereLength), 32);
                $scope.drawArm('q', qArm, vis.q, centromereLength);
                svg.style("opacity", 1)
            };

            // drawArm method uses d3 to do the actual drawing
            $scope.drawArm = function (armID, armData, armBandData, centromereOffset) {
                var arm = svg.selectAll("."+armID+"Arm")
                    .data(armData)
                .enter().append("g")
                    .attr("class", armID+"Arm");

                var armBands = arm.selectAll(".armBand")
                    .data(armBandData);

                // draws each band
                armBands.enter().append("rect")
                    .attr("class", "armBand")
                    .attr("width", function (d) { return x(d.genomic_coordinates.stop-d.genomic_coordinates.start); })
                    .attr("height", 28)
                    .attr("transform", function (d) { return "translate(" + x(d.genomic_coordinates.start+centromereOffset) + ",2)" })
                    .style("fill", function (d) { return "#"+rainbow.colorAt(d.density); })
        	        .on("mouseover", function (d) {
                        var leftOffset = svg[0][0].offsetLeft;
                        var topOffset = svg[0][0].offsetTop;
                        if(isFirefox) // firefox has an issue with the above declarations so this is a workaround
                        {
                            leftOffset = parseInt(svg[0][0].getBoundingClientRect().x+1);
                            topOffset = parseInt(svg[0][0].getBoundingClientRect().y);
                        }
                        this.style["fill"] = "#3ca6dc";
                        div.transition()
        	                .duration(200)
        	                .style("opacity", .9);
        	            div .html(d.band_label+"<br/>|")
        	                .style("left", (leftOffset + x(d.genomic_coordinates.start+centromereOffset+(d.genomic_coordinates.stop-d.genomic_coordinates.start)/2)-2) + "px")
        	                .style("top", (topOffset-30) + "px");
        	        })
        	        .on("mouseout", function (d) {
                        this.style["fill"] = "#" + rainbow.colorAt(d.density);
        	            div.transition()
        	                .duration(500)
                            .style("opacity", 0);
        	        });

                // draws the outline rect
                arm.append("rect")
                    .attr("width", function (d) { return (x(d.end-d.start) - 2); })
                    .attr("height", 30)
                    .attr("transform", function (d) { return "translate(" + (x(d.start+centromereOffset) + 1) + ",1)" })
                    .attr("stroke-width", 2)
                    .attr("stroke", "#111111")
                    .attr("fill", "none");
            }

            $scope.drawCentromere = function (pmax, width, height) {
                // add hatch pattern for centromere
                svg.append('pattern')
                    .attr('id', 'diagonalHatch')
                    .attr('patternUnits', 'userSpaceOnUse')
                    .attr('width', 4)
                    .attr('height', 4)
                    .append('path')
                        .attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
                        .attr('stroke', '#000000')
                        .attr('stroke-width', 1);

                // make polygon string for centromere
                var centromerePoly = pmax + ",0, " + (pmax + width / 2) + "," + (height / 2) + ", " + (pmax + width) + ",0, " + (pmax + width) + "," + height + ", " + (pmax + width / 2) + "," + (height / 2) + ", " + pmax + "," + height;

                // draws the centromere polygon
                svg.append("polygon")
                    .attr("transform", "translate(" + x(pmax) + ",0)" )
                    .attr("fill", "url(#diagonalHatch)")
                    .attr("points", centromerePoly);
            }

            // update the vis on window resize for responsiveness
            w.bind('resize', function () {
                $scope.resetCurrentVis();
            });

            $scope.init();
        }
    };
}]);