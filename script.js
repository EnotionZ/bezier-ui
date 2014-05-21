var $ = document.querySelector.bind(document);
var canvas = $('canvas');
var ctx = canvas.getContext('2d');

var width = 400;
var height = 400;


var pointList = [];
var Point = function(pt, type) {

	// normal | control
	this.type = type || 'normal';

	this.state = {
		x: pt[0],
		y: pt[1],
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

Point.prototype.setOffset = function(dx, dy) {
	this.state.x += dx;
	this.state.y += dy;
};

Point.prototype.setPosition = function(x, y, silent) {
	var dx = x - this.state.x;
	var dy = y - this.state.y;
	this.state.x = x;
	this.state.y = y;

	if(!silent && this.onPositionChange) this.onPositionChange(dx, dy);
};

Point.prototype.setState = function(state) {
	this.state.state = state;
	return this;
};

Point.prototype.isCollide = function(x, y) {
	var distance = Math.sqrt(Math.pow(x-this.state.x, 2) + Math.pow(y-this.state.y,2));
	return distance <= this.state.radius;
};

Point.prototype.draw = function() {
	ctx.beginPath();
	ctx.arc(this.state.x, this.state.y, this.state.radius, 0, Math.PI*2, true);
	ctx.fillStyle = this.fillStyle[this.state.state];
	ctx.fill();
};

Point.prototype.toJSON = function() {
	return [this.state.x, this.state.y];
};

/* Line Segment */
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

LineSegment.prototype.first = function() {
	var segment = this;
	while (segment.prev) segment = segment.prev;
	return segment;
};

LineSegment.prototype.last = function() {
	var segment = this;
	while (segment.next) segment = segment.next;
	return segment;
};

LineSegment.prototype.isFirst = function() { return !this.prev; };

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

LineSegment.prototype.toJSON = function() {
	var out = { pt: this.pt.toJSON() };
	if(!this.isFirst()) {
		out.cp1 = this.cp1.toJSON();
		out.cp2 = this.cp2.toJSON();
	}
	return out;
};


/* Bezier */
var BezierPath = function(curve) {
	this.state = {
		down: false,
		hoverPoint: null
	};

	this.segment = null;
	this.setPath(curve);

	canvas.addEventListener('mousemove', this.mousemove.bind(this));
	canvas.addEventListener('mousedown', this.mousedown.bind(this));
	canvas.addEventListener('mouseup', this.mouseup.bind(this));
};

BezierPath.prototype.mousedown = function(e) {
	if(this.state.hoverPoint) {
		this.state.down = true;
		this.state.hoverPoint.setState('active');
		this.draw();
	}
};

BezierPath.prototype.mouseup = function(e) {
	this.state.down = false;
};

BezierPath.prototype.mousemove = function(e) {
	var x = e.offsetX, y = e.offsetY;
	if(this.state.down) {
		this.state.hoverPoint.setPosition(x, y);
		this.draw();
	} else {
		this.checkHover(x, y);
	}
};

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

BezierPath.prototype.setPath = function(curve) {
	pointList = [];
	this.segment = null;

	if(typeof curve === 'string') curve = JSON.parse(curve);

	curve.forEach(function(point) {
		var segment = new LineSegment(point);
		if(this.segment) {
			this.segment.next = segment;
			segment.prev = this.segment;
		}
		this.segment = segment;
	}.bind(this));

	this.draw();
};

BezierPath.prototype.draw = function() {
	canvas.width = canvas.width;
	ctx.beginPath();
	this.segment.first().draw();
	ctx.stroke();
	this.segment.first().drawCtrl();
};

BezierPath.prototype.toJSON = function(stringify) {
	var out = [];
	var segment = this.segment.first();
	do {
		out.push(segment.toJSON());
	} while (segment = segment.next);
	if(stringify) out = JSON.stringify(out);
	return out;
};




var defaultCurve = [
	{ pt: [0, 0] },
	{
		cp1: [100,0],
		cp2: [100,250],
		pt: [300,250]
	},
	{
		cp1: [500,250],
		cp2: [500,500],
		pt: [600,500]
	}
];

var b = new BezierPath(defaultCurve);
