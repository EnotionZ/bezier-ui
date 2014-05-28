var $ = document.querySelector.bind(document);
var canvas = $('canvas');
var ctx = canvas.getContext('2d');

var padding = 40;
var width = 600;
var height = 500;


var pointList = [];

/**
 * Object representing {x, y} coordinate pairs
 * @param {pt} array x = pt[0], y = pt[1]
 * @param {type} string normal | control
 */
var Point = function(pt, type) {

	// normal | control
	this.type = type || 'normal';

	this.state = {
		x: pt[0] + padding,
		y: pt[1] + padding,
		radius: 5,
		state: 'base'
	};

	this.baseFill = {
		normal: '#000',
		control: '#999'
	};

	this.fillStyle = {
		base: this.baseFill[this.type],
		hover: '#00ff00',
		active: 'red'
	};
};

/**
 * Change relative position
 * @param {dx} number change in x
 * @param {dy} number change in y
 */
Point.prototype.setOffset = function(dx, dy) {
	this.state.x += dx;
	this.state.y += dy;
};

/**
 * Set position of point
 * @param {x} number
 * @param {y} number
 * @param {silent} boolean fire onPositionChange method
 */
Point.prototype.setPosition = function(x, y, silent) {
	var dx = x - this.state.x;
	var dy = y - this.state.y;
	this.state.x = x;
	this.state.y = y;

	if(!silent && this.onPositionChange) this.onPositionChange(dx, dy);
};

/**
 * Change state of point
 * @param {state} string base | hover | active
 */
Point.prototype.setState = function(state) {
	this.state.state = state;
	return this;
};

/**
 * Checks if point collides with given coordinate
 * @param {x} number
 * @param {y} number
 */
Point.prototype.isCollide = function(x, y) {
	var distance = Math.sqrt(Math.pow(x-this.state.x, 2) + Math.pow(y-this.state.y,2));
	return distance <= this.state.radius;
};

/**
 * Draw point on canvas
 */
Point.prototype.draw = function() {
	ctx.beginPath();
	ctx.arc(this.state.x, this.state.y, this.state.radius, 0, Math.PI*2, true);
	ctx.fillStyle = this.fillStyle[this.state.state];
	ctx.fill();
};

/**
 * Gets JSON representation of point
 * @return {array} [x, y]
 */
Point.prototype.toJSON = function() {
	return [this.state.x-padding, this.state.y-padding];
};



/**
 * Line Segment - linked list of cubic bezier point (2 control points)
 * @param {opts} object representation of bezier point
 */
var LineSegment = function(opts) {

	this.pt = new Point(opts.pt);
	pointList.push(this.pt);

	// binding changes with point position
	this.pt.onPositionChange = function(dx, dy) {
		if(!this.isFirst()) this.cp2.setOffset(dx, dy);
		if(this.next) this.next.cp1.setOffset(dx, dy);
	}.bind(this);

	if(opts.cp1) {
		this.cp1 = new Point(opts.cp1, 'control');
		this.cp2 = new Point(opts.cp2, 'control');
		pointList.push(this.cp1);
		pointList.push(this.cp2);

		this.cp1.onPositionChange = function(dx, dy) {
			if(!this.prev.isFirst()) this.prev.cp2.setOffset(-dx, -dy);
		}.bind(this);

		this.cp2.onPositionChange = function(dx, dy) {
			if(this.next) this.next.cp1.setOffset(-dx, -dy);
		}.bind(this);
	}

	this.next = null;
	this.prev = null;
};

/**
 * Get first item in linked list
 * @return {LineSegment}
 */
LineSegment.prototype.first = function() {
	var segment = this;
	while (segment.prev) segment = segment.prev;
	return segment;
};

/**
 * Get last item in linked list
 * @return {LineSegment}
 */
LineSegment.prototype.last = function() {
	var segment = this;
	while (segment.next) segment = segment.next;
	return segment;
};

/**
 * Determine if current LineSegment is first item in linked list
 * @return {boolen}
 */
LineSegment.prototype.isFirst = function() { return !this.prev; };

/**
 * Determine if current LineSegment is last item in linked list
 * @return {boolen}
 */
LineSegment.prototype.isLast = function() { return !this.next; };

/**
 * Draw bezier curve onto the canvas
 */
LineSegment.prototype.draw = function() {
	if(this.isFirst()) {
		ctx.moveTo(this.pt.state.x, this.pt.state.y);
	} else {
		ctx.bezierCurveTo(this.cp1.state.x, this.cp1.state.y,
						this.cp2.state.x, this.cp2.state.y,
						this.pt.state.x, this.pt.state.y);
	}
	if(this.next) this.next.draw();
};

/**
 * Draw control points and main coordinate onto the canvas
 */
LineSegment.prototype.drawCtrl = function() {

	this.pt.draw();

	if(this.prev) {
		ctx.beginPath();
		ctx.moveTo(this.prev.pt.state.x, this.prev.pt.state.y);
		ctx.lineTo(this.cp1.state.x, this.cp1.state.y);
		ctx.moveTo(this.pt.state.x, this.pt.state.y);
		ctx.lineTo(this.cp2.state.x, this.cp2.state.y);
		ctx.strokeStyle="#999";
		ctx.stroke();

		this.cp1.draw();
		this.cp2.draw();
	}

	if(this.next) this.next.drawCtrl();
};

/**
 * Get JSON representation of bezier curve
 */
LineSegment.prototype.toJSON = function() {
	var out = { pt: this.pt.toJSON() };
	if(!this.isFirst()) {
		out.cp1 = this.cp1.toJSON();
		out.cp2 = this.cp2.toJSON();
	}
	return out;
};

/**
 * Compute the coordinate along the current bezier curve
 * @param {t} number along bezier curve between 0 and 1
 * @param {key} string x | y
 * @return {number} representing x | y of a given t
 */
LineSegment.prototype.cubicCompute = function(t, key) {
	var p0 = this.prev.pt.state[key];
	var p1 = this.cp1.state[key];
	var p2 = this.cp2.state[key];
	var p3 = this.pt.state[key];
	return Math.pow(1-t, 3)*p0 + 3*Math.pow(1-t, 2)*t*p1 + 3*(1-t)*Math.pow(t,2)*p2 + Math.pow(t,3)*p3;
};

/**
 * Compute {x, y} coordinate pairs along the bezier curve
 * @param {arr} array to hold coordinate objects
 */
LineSegment.prototype.computeCoord = function(arr) {
	var steps = 1000;
	var inc = 1/steps;
	if(this.isFirst()) {
		arr.push({x: this.pt.state.x, y: this.pt.state.y});
	} else {
		for(var t=0; t < 1; t+=inc) {
			arr.push({
				x: this.cubicCompute(t, 'x'),
				y: this.cubicCompute(t, 'y')
			});
		}
	}
	if(this.next) this.next.computeCoord(arr);
	else arr.push({ x: this.pt.state.x, y: this.pt.state.y });
};



/**
 * BezierPath - holds information about the two bezier Line Segments
 * @param {opts} object options
 */
var BezierPath = function(opts) {

	if(typeof opts === 'string') opts = JSON.parse(opts);

	canvas.width = width + 2*padding;
	canvas.height = height + 2*padding;

	this.state = {
		down: false,
		num_items: 8,
		hoverPoint: null
	};

	this.segment1 = null;
	this.segment2 = null;
	this.coords = [];
	this.resetPath(opts);

	document.body.addEventListener('mousemove', this.mousemove.bind(this));
	document.body.addEventListener('mouseup', this.mouseup.bind(this));
	canvas.addEventListener('mousedown', this.mousedown.bind(this));
};

/**
 * Set active state on the current hover point
 */
BezierPath.prototype.mousedown = function() {
	if(this.state.hoverPoint) {
		this.state.down = true;
		this.state.hoverPoint.setState('active');
		this.draw();
	}
};

/**
 * Cancels the mousedown state
 */
BezierPath.prototype.mouseup = function() {
	this.state.down = false;
};

/**
 * Mousemove event handler
 * @param {e} object event
 */
BezierPath.prototype.mousemove = function(e) {
	var x = e.offsetX, y = e.offsetY;
	if(this.state.down) {
		x = Math.min(Math.max(padding, x), width+padding);
		y = Math.min(Math.max(padding, y), height+padding);

		var hoverPoint = this.state.hoverPoint;
		if(hoverPoint.isFirst) x = padding;
		if(hoverPoint.isLast) x = width + padding;

		this.state.hoverPoint.setPosition(x, y);
		this.draw();
	} else if(e.target === canvas) {
		this.checkHover(x, y);
	}
};

/**
 * Sets the hoverPoint state
 * @param {x} number coordinate
 * @param {y} number coordinate
 */
BezierPath.prototype.checkHover = function(x, y) {
	var hoverPoint;
	for(var i=0; i < pointList.length; i++) {
		if(pointList[i].isCollide(x, y)) {
			hoverPoint = pointList[i].setState('hover');
			break;
		}
	}
	if(this.state.hoverPoint && this.state.hoverPoint !== hoverPoint) {
		this.state.hoverPoint.setState('base');
	}
	this.state.hoverPoint = hoverPoint;
	this.draw();
};

/**
 * Resets the current two LineSegments
 * @param {opts} object representing the top and bottom Line Segments
 */
BezierPath.prototype.resetPath = function(opts) {
	if(typeof opts === 'string') opts = JSON.parse(opts);
	pointList = [];
	this.createSegments('segment1', opts.curve1);
	this.createSegments('segment2', opts.curve2);
	this.draw();
};

/**
 * Creates a bezier LineSegment
 * @param {key} string name to store into the current instance
 * @param {curve} object representation of the LineSegment curve
 */
BezierPath.prototype.createSegments = function(key, curve) {
	this[key] = null;

	curve.forEach(function(point) {
		var segment = new LineSegment(point);
		if(this[key]) {
			this[key].next = segment;
			segment.prev = this[key];
		}
		this[key] = segment;
	}.bind(this));

	// first and last points to enable fixed x
	this[key].first().pt.isFirst = true;
	this[key].last().pt.isLast = true;
};

/**
 * Draws bezier curve onto the canvas
 */
BezierPath.prototype.draw = function() {
	canvas.width = canvas.width;

	ctx.rect(padding, padding, width, height);
	ctx.strokeStyle = '#ccc';
	ctx.stroke();

	ctx.beginPath();
	this.segment1.first().draw();
	this.segment2.first().draw();
	ctx.strokeStyle = '#111';
	ctx.stroke();

	this.segment1.first().drawCtrl();
	this.segment2.first().drawCtrl();

	this.computeCoord();
};

/**
 * Gets JSON representation of a single bezier LineSegment
 * @param {segment} LineSegment
 * @return {object} JSON representation of LineSegment
 */
BezierPath.prototype.getSegmentJSON = function(segment) {
	var out = [];
	segment = segment.first();
	do {
		out.push(segment.toJSON());
	} while (segment = segment.next);
	return out;
};

/**
 * Gets the JSON representation of the current curve
 * @param {stringify} boolean string output
 * @return {object} representing the two bezier Line Segments
 */
BezierPath.prototype.toJSON = function(stringify) {
	var out = {
		curve1: this.getSegmentJSON(this.segment1),
		curve2: this.getSegmentJSON(this.segment2)
	};
	if(stringify) out = JSON.stringify(out);
	return out;
};

/**
 * Save {x, y} pairs from a bezier curve
 */
BezierPath.prototype.storeCoords = function() {
	this._coords1 = [];
	this._coords2 = [];
	this.segment1.first().computeCoord(this._coords1);
	this.segment2.first().computeCoord(this._coords2);
};

/**
 * Get closest y-coordinate given an x coordinate
 * @param {coords} array of {x, y} coordinates of a bezier curve
 * @param {x} number
 */
BezierPath.prototype.getY = function(coords, x) {
	for(var i = 0; i < coords.length; i++) {
		if(coords[i].x >= x) return coords[i].y;
	}
};

/**
 * Get information about a single coordinate
 * @param {x} number
 */
BezierPath.prototype.getYPair = function(x) {
	var y = this.getY(this._coords1, x) - padding;
	var y2 = this.getY(this._coords2, x) - padding;
	return {
		x: (x - padding)/width,
		y: y/height,
		y2: y2/height,
		scale: (y2-y)/height,
		diff: y2-y
	};
};

/**
 * Update the spacing between each coordinate based on its height compared to
 * the average height and spacing of all coordinates
 */
BezierPath.prototype.fixCoordSpacing = function() {
	var lastIndex = this.coords.length -1;
	var heightSum = this.coords.reduce(function(a, b) {
		if(a.diff) a = a.diff;
		return a + b.diff;
	}) - this.coords[lastIndex].diff;
	var avgHeight = heightSum/(this.state.num_items);
	var spacing = width/(this.state.num_items-1);
	var ratio = spacing/avgHeight;
	var currx = padding;
	for(var i=1; i < this.coords.length; i++) {
		currx += this.coords[i-1].diff*ratio;
		this.coords[i] = this.getYPair(currx);
	}

	if(this.coords[lastIndex].x > 1) {
		this.coords[lastIndex] = this.getYPair(width+padding);
	}
};

/**
 * Compute the coordinates based on num_items
 */
BezierPath.prototype.computeCoord = function() {
	this.storeCoords();

	this.coords = [];

	// generate initial set
	var spacing = width/(this.state.num_items-1);
	for(var i=0; i < this.state.num_items-1; i++) {
		this.coords.push(this.getYPair(padding + spacing*i));
	}

	// last item
	this.coords.push(this.getYPair(width+padding));

	this.fixCoordSpacing();

	this.drawCross();
	if(this.onCoordChange) this.onCoordChange(this.coords);
};

/**
 * Retrieve coordinates information
 * @return {string} representation of coordinates array
 */
BezierPath.prototype.getCoords = function() {
	return JSON.stringify(this.coords);
};

/**
 * Draw vertical lines between the two curves at each spacing
 */
BezierPath.prototype.drawCross = function() {
	var c, x, y, y2;
	for(var i=0; i< this.coords.length; i++) {
		c = this.coords[i];
		x = c.x*width + padding;
		y = c.y*height + padding;
		y2 = c.y2*height + padding;

		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x, y2);
		ctx.strokeStyle = 'red';
		ctx.stroke();
	}
};
