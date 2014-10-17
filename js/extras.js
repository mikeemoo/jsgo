jDataView.prototype.getVarInt32 = function() {
    var b;
    var count = 0;
    var result = 0;
    do {
        if (count == 5 || this.tell() >= this.byteLength) {
            return result;
        }
        b = this.getUint8();
        result |= (b & 0x7F) << (7 * count);
        ++count;
    } while (b & 0x80);
    return result;
}

jDataView.prototype.findNextNull = function(length) {
    var o = 0;
    while (this.tell() < this.byteLength - 1 && this.getUint8() != 0 && length--) o++;
    this.skip(-o - 1);
    return o;
}

jDataView.prototype.getTerminatedString = function(length, contract) {
    var offset = this.tell();
    length = Math.min(length, this.byteLength - offset);
    var bytes = this.getBytes(length);
    var nullChar = 0;
    for (var i = 0; i < bytes.length; i++) {
        if (bytes[i] == 0) {
            nullChar = i;
            break;
        }
    }
    this.seek(offset);
    var str = this.getString(nullChar + 1);
    if (!contract) {
        this.seek(offset + length);
    }
    return str.substring(0, str.length - 1);
}

jDataView.prototype.chunk = function(size) {
    return this.slice(this.tell(), this.tell() + size, true);
}