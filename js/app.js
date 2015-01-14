var app = angular.module('id3ogram', [])
.controller('id3ogramController', ['$scope', '$http', function($scope, $http) {
	// app vars
    $scope.info = '';
	$scope.chromosomes = [];
	$scope.currentChromosome = null;
    $scope.dataByCh = {};

    // static vis vars
    $scope.rainbow = new Rainbow();

    // current vis vars
    $scope.vis = {};
    $scope.vis.aspect;
    $scope.vis.container;
    $scope.vis.q = [];
    $scope.vis.p = [];
    $scope.vis.qmin = Infinity;
    $scope.vis.qmax = -Infinity;
    $scope.vis.pmin = Infinity;
    $scope.vis.pmax = -Infinity;
    $scope.vis.minDensity = Infinity;
    $scope.vis.minDensity = -Infinity;
    $scope.vis.svg;
    $scope.vis.pArm = []
    $scope.vis.qArm = []
    $scope.vis.x;

	$http.get('http://api.solvebio.com/v1/datasets/ISCN/1.0.1-2015-01-05/Ideograms/data?access_token=98e8f6ba570311e4bab59f6dc3060e21').
	  success(function(data, status, headers, config) {
	    // this callback will be called asynchronously
	    // when the response is available
		  $scope.setData(data.results);
		  $scope.info += 'dataset:' + data.dataset;
		  $scope.info += '  ID:' + data.dataset_id;
		  $scope.info += '  Build:' + data.genome_build;
	  }).
	  error(function(data, status, headers, config) {
	    // called asynchronously if an error occurs
	    // or server returns response with an error status.
		  $scope.info = 'Failed to load data from SolveBio';
	  });

	  $scope.setData = function(data) {
          // separate data by chromosomes
		  data.forEach(function(d){
			  var ch = parseInt(d.genomic_coordinates.chromosome);

              if(!(ch in $scope.dataByCh))
                  $scope.dataByCh[ch] = [];

              $scope.dataByCh[ch].push(d);
          });

          $scope.init();
	  };

      $scope.init = function() {
          $scope.chromosomes = Object.keys($scope.dataByCh);
		  $scope.currentChromosome = $scope.chromosomes[0];

          $scope.rainbow.setSpectrum('#dddddd','#000000');

      	  div = d3.select("#vis").append("div")
      		.attr("class", "tooltip")
      		.style("opacity", 0);

          $scope.vis.svg = d3.select("#vis").append("svg")
              .attr("width", document.getElementById('vis').offsetWidth)
              .attr("height", 60)
              .attr("perserveAspectRatio", "xMinYMid");

          $scope.vis.aspect = $scope.vis.svg.width / $scope.vis.svg.height;
          $scope.vis.container = document.getElementById('vis');

          // $(window).on("resize", function() {
          //     var targetWidth = $scope.vis.container.width();
          //     $scope.vis.svg.attr("width", targetWidth);
          //     $scope.vis.svg.attr("height", Math.round(targetWidth / $scope.vis.aspect));
          // }).trigger("resize");

          $scope.resetCurrentVis();
      }

      $scope.resetCurrentVis = function() {
          var currentData = $scope.dataByCh[$scope.currentChromosome]

          // reset vars
          $scope.vis.q = [];
          $scope.vis.p = [];

          currentData.forEach(function(d) {
              $scope.vis[d.arm].push(d);
          });

          $scope.vis.qmin = d3.min($scope.vis.q, function(d) { return d.genomic_coordinates.start });
          $scope.vis.qmax = d3.max($scope.vis.q, function(d) { return d.genomic_coordinates.stop });
          $scope.vis.pmin = d3.min($scope.vis.p, function(d) { return d.genomic_coordinates.start });
          $scope.vis.pmax = d3.max($scope.vis.p, function(d) { return d.genomic_coordinates.stop });

          $scope.vis.x = d3.scale.linear()
            .rangeRound([0, document.getElementById('vis').offsetWidth]);
          $scope.vis.x.domain([0, $scope.vis.qmax]);

          $scope.vis.pArm = []
          $scope.vis.pArm.push({start: 0, end: ($scope.vis.pmax + ($scope.vis.qmin-$scope.vis.pmax)/2) })

          $scope.vis.qArm = []
          $scope.vis.qArm.push({start: ($scope.vis.pmax + ($scope.vis.qmin-$scope.vis.pmax)/2), end: $scope.vis.qmax })

          $scope.vis.minDensity = d3.min(currentData, function(d) { return d.density });
          $scope.vis.maxDensity = d3.max(currentData, function(d) { return d.density });

          $scope.rainbow.setNumberRange($scope.vis.minDensity, $scope.vis.maxDensity);

          $scope.vis.svg.selectAll("*").remove();
          $scope.drawArm('p', $scope.vis.pArm, $scope.vis.p);
          $scope.drawArm('q', $scope.vis.qArm, $scope.vis.q);
      };

      $scope.drawArm = function(armID, armData, armBandData) {
          var arm = $scope.vis.svg.selectAll("."+armID+"Arm")
              .data(armData)
          .enter().append("g")
              .attr("class", armID+"Arm");

          arm.append("rect")
              .attr("rx", 5)
              .attr("ry", 5)
              .attr("width", function(d) { return $scope.vis.x(d.end-d.start); })
              .attr("height", 50)
              .attr("transform", function(d) { return "translate(" + $scope.vis.x(d.start) + ",0)" })
              .attr("fill", "#fafafa");

          var armBands = arm.selectAll(".armBand")
              .data(armBandData);

          armBands.enter().append("rect")
              .attr("class", "armBand")
              .attr("width", function(d) { return $scope.vis.x(d.genomic_coordinates.stop-d.genomic_coordinates.start); })
              .attr("height", 48)
              .attr("transform", function(d) { return "translate(" + $scope.vis.x(d.genomic_coordinates.start) + ",1)" })
              .style("fill", function(d) { return "#"+$scope.rainbow.colorAt(d.density); })
    	      .on("mouseover", function(d) {
                  this.style["fill"] = "#3ca6dc"
                  div.transition()
    	              .duration(200)
    	              .style("opacity", .9);
    	          div .html(d.band_label+"<br/>|")
    	              .style("left", ($scope.vis.svg[0][0].offsetLeft + $scope.vis.x(d.genomic_coordinates.start+(d.genomic_coordinates.stop-d.genomic_coordinates.start)/2)-2) + "px")
    	              .style("top", $scope.vis.svg[0][0].offsetTop-30 + "px");
    	      })
    	      .on("mouseout", function(d) {
                  this.style["fill"] = "#" + $scope.rainbow.colorAt(d.density);
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
              .attr("width", function(d) { return $scope.vis.x(d.end-d.start); })
              .attr("height", 50)
              .attr("transform", function(d) { return "translate(" + $scope.vis.x(d.start) + ",0)" })
              .attr("stroke-width", 1)
              .attr("stroke", "#111111")
              .attr("fill", "none");
      }
}]);