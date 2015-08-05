(function () {
    function Vector3d(x, y, z) {
        this.x = x !== undefined ? x : 0;
        this.y = y !== undefined ? y : 0;
        this.z = z !== undefined ? z : 0;
    }

    Vector3d.prototype.add = function (b) {
        return new Vector3d(this.x + b.x, this.y + b.y, this.z + b.z);
    }

    Vector3d.prototype.subtract = function (b) {
        return new Vector3d(this.x - b.x, this.y - b.y, this.z - b.z);
    }

    Vector3d.prototype.multiply = function (scalar) {
        return new Vector3d(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    Vector3d.prototype.scale = function (b) {
        return new Vector3d(this.x * b.x, this.y * b.y, this.z * b.z);
    }

    Vector3d.prototype.length = function () {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    Vector3d.prototype.lengthSquared = function () {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    Vector3d.prototype.normalize = function () {
        var l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        this.x /= l;
        this.y /= l;
        this.z /= l;
        return this;
    }

    Vector3d.prototype.dot = function (b) {
        return this.x * b.x + this.y * b.y + this.z * b.z;
    }

    Vector3d.prototype.cross = function (b) {
        return new Vector3d(this.y * b.z - b.y * this.z,
            b.x * this.z - this.x * b.z,
            this.x * b.y - b.x * this.y);
    }

    Vector3d.prototype.clone = function () {
        return new Vector3d(this.x, this.y, this.z);
    }

    Vector3d.prototype.distanceFrom = function (b) {
        var dx = b.x - this.x,
            dy = b.y - this.y,
            dz = b.z - this.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    Vector3d.prototype.pitchAndYawTo = function (position) {
        var dx = this.x - position.x;
        var dy = this.y - position.y;
        var dz = this.z - position.z;
        return {
            pitch: makeAnglePositive(-toDegrees(Math.atan2(dz, Math.sqrt(dx * dx + dy * dy)))),
            yaw: makeAnglePositive(toDegrees(Math.atan2(dy, dx)) + 180)
        }
    }

    function makeAnglePositive(ang) {
        return (ang % 360 + 360) % 360;
    }

    function directionToVector(pitch, yaw) {

        var pitchRadians = toRadians(90 - pitch);
        var yawRadians = toRadians(yaw);

        return new Vector3d(
            Math.sin(pitchRadians) * Math.cos(yawRadians),
            Math.sin(pitchRadians) * Math.sin(yawRadians),
            Math.cos(pitchRadians)
        );
    }

    function Line3d(x, y, z, direction) {
        this.direction = direction;
        Vector3d.apply(this, arguments);
    }

    inherits(Line3d, Vector3d);

    Line3d.prototype.distanceToPoint = function (point) {
        var distance = point.distanceFrom(this);
        var aimPoint = this.add(this.direction.multiply(distance));
        return point.distanceFrom(aimPoint);
    }
    module.exports.Vector3d = Vector3d;
    module.exports.Line3d = Line3d;
})
