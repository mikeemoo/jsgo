(function() {

    var root = this;

    function toRadians(num) {
        return num * (Math.PI / 180);
    }

    function toDegrees(num) {
        return num * (180 / Math.PI);
    }

    function inherits(childConstructor, parentConstructor) {
        function tempConstructor() {};
        tempConstructor.prototype = parentConstructor.prototype;
        childConstructor.prototype = new tempConstructor();
        childConstructor.prototype.constructor = childConstructor;
    };

    /*!
     * EventEmitter2
     * https://github.com/hij1nx/EventEmitter2
     *
     * Copyright (c) 2013 hij1nx
     * Licensed under the MIT license.
     */
    var EventEmitter = function() {

        var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
            return Object.prototype.toString.call(obj) === "[object Array]";
        };
        var defaultMaxListeners = 10;

        function init() {
            this._events = {};
            if (this._conf) {
                configure.call(this, this._conf);
            }
        }

        function configure(conf) {
            if (conf) {

                this._conf = conf;

                conf.delimiter && (this.delimiter = conf.delimiter);
                conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
                conf.wildcard && (this.wildcard = conf.wildcard);
                conf.newListener && (this.newListener = conf.newListener);

                if (this.wildcard) {
                    this.listenerTree = {};
                }
            }
        }

        function EventEmitter(conf) {
            this._events = {};
            this.newListener = false;
            configure.call(this, conf);
        }

        //
        // Attention, function return type now is array, always !
        // It has zero elements if no any matches found and one or more
        // elements (leafs) if there are matches
        //
        function searchListenerTree(handlers, type, tree, i) {
            if (!tree) {
                return [];
            }
            var listeners = [],
                leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
                typeLength = type.length,
                currentType = type[i],
                nextType = type[i + 1];
            if (i === typeLength && tree._listeners) {
                //
                // If at the end of the event(s) list and the tree has listeners
                // invoke those listeners.
                //
                if (typeof tree._listeners === 'function') {
                    handlers && handlers.push(tree._listeners);
                    return [tree];
                } else {
                    for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
                        handlers && handlers.push(tree._listeners[leaf]);
                    }
                    return [tree];
                }
            }

            if ((currentType === '*' || currentType === '**') || tree[currentType]) {
                //
                // If the event emitted is '*' at this part
                // or there is a concrete match at this patch
                //
                if (currentType === '*') {
                    for (branch in tree) {
                        if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
                            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i + 1));
                        }
                    }
                    return listeners;
                } else if (currentType === '**') {
                    endReached = (i + 1 === typeLength || (i + 2 === typeLength && nextType === '*'));
                    if (endReached && tree._listeners) {
                        // The next element has a _listeners, add it to the handlers.
                        listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
                    }

                    for (branch in tree) {
                        if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
                            if (branch === '*' || branch === '**') {
                                if (tree[branch]._listeners && !endReached) {
                                    listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
                                }
                                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
                            } else if (branch === nextType) {
                                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i + 2));
                            } else {
                                // No match on this one, shift into the tree but not in the type array.
                                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
                            }
                        }
                    }
                    return listeners;
                }

                listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i + 1));
            }

            xTree = tree['*'];
            if (xTree) {
                //
                // If the listener tree will allow any match for this part,
                // then recursively explore all branches of the tree
                //
                searchListenerTree(handlers, type, xTree, i + 1);
            }

            xxTree = tree['**'];
            if (xxTree) {
                if (i < typeLength) {
                    if (xxTree._listeners) {
                        // If we have a listener on a '**', it will catch all, so add its handler.
                        searchListenerTree(handlers, type, xxTree, typeLength);
                    }

                    // Build arrays of matching next branches and others.
                    for (branch in xxTree) {
                        if (branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
                            if (branch === nextType) {
                                // We know the next element will match, so jump twice.
                                searchListenerTree(handlers, type, xxTree[branch], i + 2);
                            } else if (branch === currentType) {
                                // Current node matches, move into the tree.
                                searchListenerTree(handlers, type, xxTree[branch], i + 1);
                            } else {
                                isolatedBranch = {};
                                isolatedBranch[branch] = xxTree[branch];
                                searchListenerTree(handlers, type, {
                                    '**': isolatedBranch
                                }, i + 1);
                            }
                        }
                    }
                } else if (xxTree._listeners) {
                    // We have reached the end and still on a '**'
                    searchListenerTree(handlers, type, xxTree, typeLength);
                } else if (xxTree['*'] && xxTree['*']._listeners) {
                    searchListenerTree(handlers, type, xxTree['*'], typeLength);
                }
            }

            return listeners;
        }

        function growListenerTree(type, listener) {

            type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

            //
            // Looks for two consecutive '**', if so, don't add the event at all.
            //
            for (var i = 0, len = type.length; i + 1 < len; i++) {
                if (type[i] === '**' && type[i + 1] === '**') {
                    return;
                }
            }

            var tree = this.listenerTree;
            var name = type.shift();

            while (name) {

                if (!tree[name]) {
                    tree[name] = {};
                }

                tree = tree[name];

                if (type.length === 0) {

                    if (!tree._listeners) {
                        tree._listeners = listener;
                    } else if (typeof tree._listeners === 'function') {
                        tree._listeners = [tree._listeners, listener];
                    } else if (isArray(tree._listeners)) {

                        tree._listeners.push(listener);

                        if (!tree._listeners.warned) {

                            var m = defaultMaxListeners;

                            if (typeof this._events.maxListeners !== 'undefined') {
                                m = this._events.maxListeners;
                            }

                            if (m > 0 && tree._listeners.length > m) {

                                tree._listeners.warned = true;
                                console.error('(node) warning: possible EventEmitter memory ' +
                                    'leak detected. %d listeners added. ' +
                                    'Use emitter.setMaxListeners() to increase limit.',
                                    tree._listeners.length);
                                console.trace();
                            }
                        }
                    }
                    return true;
                }
                name = type.shift();
            }
            return true;
        }

        // By default EventEmitters will print a warning if more than
        // 10 listeners are added to it. This is a useful default which
        // helps finding memory leaks.
        //
        // Obviously not all Emitters should be limited to 10. This function allows
        // that to be increased. Set to zero for unlimited.

        EventEmitter.prototype.delimiter = '.';

        EventEmitter.prototype.setMaxListeners = function(n) {
            this._events || init.call(this);
            this._events.maxListeners = n;
            if (!this._conf) this._conf = {};
            this._conf.maxListeners = n;
        };

        EventEmitter.prototype.event = '';

        EventEmitter.prototype.once = function(event, fn) {
            this.many(event, 1, fn);
            return this;
        };

        EventEmitter.prototype.many = function(event, ttl, fn) {
            var self = this;

            if (typeof fn !== 'function') {
                throw new Error('many only accepts instances of Function');
            }

            function listener() {
                if (--ttl === 0) {
                    self.off(event, listener);
                }
                fn.apply(this, arguments);
            }

            listener._origin = fn;

            this.on(event, listener);

            return self;
        };

        EventEmitter.prototype.emit = function() {

            this._events || init.call(this);

            var type = arguments[0];

            if (type === 'newListener' && !this.newListener) {
                if (!this._events.newListener) {
                    return false;
                }
            }

            // Loop through the *_all* functions and invoke them.
            if (this._all) {
                var l = arguments.length;
                var args = new Array(l - 1);
                for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
                for (i = 0, l = this._all.length; i < l; i++) {
                    this.event = type;
                    this._all[i].apply(this, args);
                }
            }

            // If there is no 'error' event listener then throw.
            if (type === 'error') {

                if (!this._all &&
                    !this._events.error &&
                    !(this.wildcard && this.listenerTree.error)) {

                    if (arguments[1] instanceof Error) {
                        throw arguments[1]; // Unhandled 'error' event
                    } else {
                        throw new Error("Uncaught, unspecified 'error' event.");
                    }
                    return false;
                }
            }

            var handler;

            if (this.wildcard) {
                handler = [];
                var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
                searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
            } else {
                handler = this._events[type];
            }

            if (typeof handler === 'function') {
                this.event = type;
                if (arguments.length === 1) {
                    handler.call(this);
                } else if (arguments.length > 1)
                    switch (arguments.length) {
                        case 2:
                            handler.call(this, arguments[1]);
                            break;
                        case 3:
                            handler.call(this, arguments[1], arguments[2]);
                            break;
                            // slower
                        default:
                            var l = arguments.length;
                            var args = new Array(l - 1);
                            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
                            handler.apply(this, args);
                    }
                return true;
            } else if (handler) {
                var l = arguments.length;
                var args = new Array(l - 1);
                for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

                var listeners = handler.slice();
                for (var i = 0, l = listeners.length; i < l; i++) {
                    this.event = type;
                    listeners[i].apply(this, args);
                }
                return (listeners.length > 0) || !!this._all;
            } else {
                return !!this._all;
            }

        };

        EventEmitter.prototype.on = function(type, listener) {

            if (typeof type === 'function') {
                this.onAny(type);
                return this;
            }

            if (typeof listener !== 'function') {
                throw new Error('on only accepts instances of Function');
            }
            this._events || init.call(this);

            // To avoid recursion in the case that type == "newListeners"! Before
            // adding it to the listeners, first emit "newListeners".
            this.emit('newListener', type, listener);

            if (this.wildcard) {
                growListenerTree.call(this, type, listener);
                return this;
            }

            if (!this._events[type]) {
                // Optimize the case of one listener. Don't need the extra array object.
                this._events[type] = listener;
            } else if (typeof this._events[type] === 'function') {
                // Adding the second element, need to change to array.
                this._events[type] = [this._events[type], listener];
            } else if (isArray(this._events[type])) {
                // If we've already got an array, just append.
                this._events[type].push(listener);

                // Check for listener leak
                if (!this._events[type].warned) {

                    var m = defaultMaxListeners;

                    if (typeof this._events.maxListeners !== 'undefined') {
                        m = this._events.maxListeners;
                    }

                    if (m > 0 && this._events[type].length > m) {

                        this._events[type].warned = true;
                        console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            this._events[type].length);
                        console.trace();
                    }
                }
            }
            return this;
        };

        EventEmitter.prototype.onAny = function(fn) {

            if (typeof fn !== 'function') {
                throw new Error('onAny only accepts instances of Function');
            }

            if (!this._all) {
                this._all = [];
            }

            // Add the function to the event listener collection.
            this._all.push(fn);
            return this;
        };

        EventEmitter.prototype.addListener = EventEmitter.prototype.on;

        EventEmitter.prototype.off = function(type, listener) {
            if (typeof listener !== 'function') {
                throw new Error('removeListener only takes instances of Function');
            }

            var handlers, leafs = [];

            if (this.wildcard) {
                var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
                leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
            } else {
                // does not use listeners(), so no side effect of creating _events[type]
                if (!this._events[type]) return this;
                handlers = this._events[type];
                leafs.push({
                    _listeners: handlers
                });
            }

            for (var iLeaf = 0; iLeaf < leafs.length; iLeaf++) {
                var leaf = leafs[iLeaf];
                handlers = leaf._listeners;
                if (isArray(handlers)) {

                    var position = -1;

                    for (var i = 0, length = handlers.length; i < length; i++) {
                        if (handlers[i] === listener ||
                            (handlers[i].listener && handlers[i].listener === listener) ||
                            (handlers[i]._origin && handlers[i]._origin === listener)) {
                            position = i;
                            break;
                        }
                    }

                    if (position < 0) {
                        continue;
                    }

                    if (this.wildcard) {
                        leaf._listeners.splice(position, 1);
                    } else {
                        this._events[type].splice(position, 1);
                    }

                    if (handlers.length === 0) {
                        if (this.wildcard) {
                            delete leaf._listeners;
                        } else {
                            delete this._events[type];
                        }
                    }
                    return this;
                } else if (handlers === listener ||
                    (handlers.listener && handlers.listener === listener) ||
                    (handlers._origin && handlers._origin === listener)) {
                    if (this.wildcard) {
                        delete leaf._listeners;
                    } else {
                        delete this._events[type];
                    }
                }
            }

            function recursivelyGarbageCollect(root) {
                if (root === undefined) {
                    return;
                }
                var keys = Object.keys(root);
                for (var i in keys) {
                    var key = keys[i];
                    var obj = root[key];
                    if (obj instanceof Function)
                        continue;
                    if (Object.keys(obj).length > 0) {
                        recursivelyGarbageCollect(root[key]);
                    }
                    if (Object.keys(obj).length === 0) {
                        delete root[key];
                    }
                }
            }
            recursivelyGarbageCollect(this.listenerTree);

            return this;
        };

        EventEmitter.prototype.offAny = function(fn) {
            var i = 0,
                l = 0,
                fns;
            if (fn && this._all && this._all.length > 0) {
                fns = this._all;
                for (i = 0, l = fns.length; i < l; i++) {
                    if (fn === fns[i]) {
                        fns.splice(i, 1);
                        return this;
                    }
                }
            } else {
                this._all = [];
            }
            return this;
        };

        EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

        EventEmitter.prototype.removeAllListeners = function(type) {
            if (arguments.length === 0) {
                !this._events || init.call(this);
                return this;
            }

            if (this.wildcard) {
                var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
                var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

                for (var iLeaf = 0; iLeaf < leafs.length; iLeaf++) {
                    var leaf = leafs[iLeaf];
                    leaf._listeners = null;
                }
            } else {
                if (!this._events[type]) return this;
                this._events[type] = null;
            }
            return this;
        };

        EventEmitter.prototype.listeners = function(type) {
            if (this.wildcard) {
                var handlers = [];
                var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
                searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
                return handlers;
            }

            this._events || init.call(this);

            if (!this._events[type]) this._events[type] = [];
            if (!isArray(this._events[type])) {
                this._events[type] = [this._events[type]];
            }
            return this._events[type];
        };

        EventEmitter.prototype.listenersAny = function() {

            if (this._all) {
                return this._all;
            } else {
                return [];
            }

        };

        return EventEmitter;

    }();

    /**************************************
     * BitStream
     ***************************************/

    var kCW_None = 0;
    var kCW_LowPrecision = 1;
    var kCW_Integral = 2;

    function BitStream(buffer) {
        this.buffer = buffer;
        this.index = 0;
        this.bufferedBits = null;
        this.bitsAvailable = 0;
    }

    BitStream.prototype.protobuf = function(collector, size) {
        var def = new ProtobufDefinition();
        collector(def);
        var data = {};
        size = size || this.varInt32();
        var offset = this.tell();
        while (this.tell() < offset + size) {
            var tag = this.varInt32();
            var id = tag >> 3;
            var field = def.getField(id);
            if (field != null) {
                var val = null;
                if (typeof field.method == 'string') {
                    if (this[field.method] == null) {
                        throw Error('Unable to find method ' + field.method);
                    }
                    val = this[field.method].apply(this, field.args);
                } else {
                    val = field.method(field.args);
                }


                if (field.type == 'array') {
                    if (data[field.name] == null) {
                        data[field.name] = [];
                    }
                    data[field.name].push(val);
                } else {
                    data[field.name] = val;
                }
            }
        }
        this.seek(offset + size);
        return data;
    }

    BitStream.prototype.int32 = function() {
        return this.flatten(4);
    }

    BitStream.prototype.vString = function() {
        var length = this.varInt32();
        if (length == 0) {
            return '';
        }
        return this.string(length, true);
    }

    BitStream.prototype.varInt32 = function() {
        return this.varInt(4);
    }

    BitStream.prototype.varInt64 = function() {
        return this.varInt(8); // yeah whatever. it wont read a valid int64 for now.
    }

    BitStream.prototype.varInt = function(maxLen) {
        var b = 0;
        var count = 0;
        var result = 0;
        do {
            if (count + 1 == maxLen) {
                return result;
            }
            b = this.byte();
            result |= (b & 0x7F) << (7 * count);
            ++count;
        } while (b & 0x80);
        return result;
    }

    BitStream.prototype.varInt32Bool = function() {
        return !(!this.varInt32());
    }

    BitStream.prototype.uBitVar = function() {
        var ret = this.bits(6);
        switch (ret & (16 | 32)) {
            case 16:
                ret = (ret & 15) | (this.bits(4) << 4);
                break;
            case 32:
                ret = (ret & 15) | (this.bits(8) << 4);
                break;
            case 48:
                ret = (ret & 15) | (this.bits(32 - 4) << 4);
                break;
        }
        return ret;
    }

    BitStream.prototype.int16 = function() {
        return this.flatten(2);
    }

    BitStream.prototype.float = function() {
        var b = this.bytes(4),
            sign = 1 - (2 * (b[3] >> 7)),
            exponent = (((b[3] << 1) & 0xff) | (b[2] >> 7)) - 127,
            mantissa = ((b[2] & 0x7f) << 16) | (b[1] << 8) | b[0];

        if (exponent === 128) {
            if (mantissa !== 0) {
                return NaN;
            } else {
                return sign * Infinity;
            }
        }

        if (exponent === -127) {
            return sign * mantissa * this.pow2(-126 - 23);
        }

        return sign * (1 + mantissa * this.pow2(-23)) * this.pow2(exponent);
    }

    BitStream.prototype.vChunk = function() {
        var size = this.varInt32();
        var buffer = new Buffer(size);
        for (var i = 0; i < size; i++) {
            buffer.writeUInt8(this.byte(), i);
        }
        return new BitStream(buffer);
    }

    BitStream.prototype.pow2 = function(n) {
        return (n >= 0 && n < 31) ? (1 << n) : (this.pow2[n] || (this.pow2[n] = Math.pow(2, n)));
    }

    BitStream.prototype.flatten = function(bytes) {
        if (typeof bytes === 'number' && isFinite(bytes)) {
            bytes = this.bytes(bytes);
        }
        var ret = 0;
        for (var i = 0; i < bytes.length; i++) {
            ret |= bytes[i] << (i << 3);
        }
        return ret;
    }

    BitStream.prototype.skip = function(bytes) {
        this.index += bytes;
        if (this.bitsAvailable !== 0) {
            this.bufferedBits = this.takeByteAt(this.index - 1);
        }
        return this;
    }

    BitStream.prototype.seekBits = function(dest) {
        this.index = dest >> 3;
        this.clearBufferedBits();
        this.bits(dest % 8);
    }

    BitStream.prototype.seek = function(dest) {
        this.index = dest;
        this.clearBufferedBits();
        return this;
    }

    BitStream.prototype.tell = function() {
        return this.index;
    }

    BitStream.prototype.tellBits = function() {
        return ((this.index - 1) << 3) + (8 - this.bitsAvailable);
    }

    BitStream.prototype.string = function(len, nongreedy) {
        var str = '';
        for (var i = 0; i < len; i++) {
            var char = this.byte();
            if (char == 0) {
                if (!nongreedy) {
                    this.skip(len - i - 1);
                }
                break;
            }
            str += String.fromCharCode(char);
        }
        return str;
    }

    BitStream.prototype.byte = function() {
        return this.bits(8);
    }

    BitStream.prototype.bool = function() {
        return !(!this.byte());
    }

    BitStream.prototype.bytes = function(bytes) {
        var result = [];
        for (var i = 0; i < bytes; i++) {
            result.push(this.byte());
        }
        return result;
    }

    BitStream.prototype.takeByteAt = function(index) {
        return this.buffer[index];
    }

    BitStream.prototype.takeByte = function() {
        return this.takeByteAt(this.index++);
    }

    BitStream.prototype.bits = function(bits) {
        if (bits == 8 && this.bitsAvailable == 0) {
            return this.takeByte();
        }
        var ret = 0;
        for (var i = 0; i < bits; i++) {
            if (this.bitsAvailable == 0) {
                this.bufferedBits = this.takeByte();
                this.bitsAvailable = 8;
            }
            ret |= ((this.bufferedBits >> (8 - this.bitsAvailable--)) & 1) << i;
        }
        return ret;
    }

    BitStream.prototype.clearBufferedBits = function() {
        this.bufferedBits = null;
        this.bitsAvailable = 0;
        return this;
    }

    BitStream.prototype.bitCoord = function() {
        var value = 0;
        var intval = this.bits(1);
        var fractval = this.bits(1);
        if (intval || fractval) {
            var signbit = this.bits(1);
            if (intval) {
                intval = this.bits(14) + 1;
            }
            if (fractval) {
                fractval = this.bits(5);
            }
            value = intval + (fractval * (1 / (1 << 5)));
            if (signbit) {
                value = -value;
            }
        }
        return value;
    }

    BitStream.prototype.bitNormal = function() {

        var signbit = this.bits(1);
        var fractval = this.bits(11);

        var value = fractval * (1 / ((1 << 11) - 1));

        if (signbit) {
            value = -value;
        }

        return value;
    }

    BitStream.prototype.bitCellCoord = function(bits, coordType) {
        var bIntegral = coordType == kCW_Integral;
        var bLowPrecision = coordType == kCW_LowPrecision;
        var value = 0;
        if (bIntegral) {
            return this.bits(bits);
        }
        var intval = this.bits(bits);
        var fractval = this.bits(bLowPrecision ? 3 : 5);
        return value = intval + (fractval * (1 / (1 << (bLowPrecision ? 3 : 5))));
    }


    function ProtobufDefinition() {
        this.fields = {};
    }
    ProtobufDefinition.prototype.addField = function(id, name, method, args, type) {
        this.fields[id] = {
            'name': name,
            'method': method,
            'type': type || 'value',
            'args': args || []
        };
        return this;
    }
    ProtobufDefinition.prototype.getField = function(id) {
        return this.fields[id]
    }

    function Vector3d(x, y, z) {
        this.x = x !== undefined ? x : 0;
        this.y = y !== undefined ? y : 0;
        this.z = z !== undefined ? z : 0;
    }

    Vector3d.prototype.add = function(b) {
        return new Vector3d(this.x + b.x, this.y + b.y, this.z + b.z);
    }

    Vector3d.prototype.subtract = function(b) {
        return new Vector3d(this.x - b.x, this.y - b.y, this.z - b.z);
    }

    Vector3d.prototype.multiply = function(scalar) {
        return new Vector3d(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    Vector3d.prototype.scale = function(b) {
        return new Vector3d(this.x * b.x, this.y * b.y, this.z * b.z);
    }

    Vector3d.prototype.length = function() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    Vector3d.prototype.lengthSquared = function() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    Vector3d.prototype.normalize = function() {
        var l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        this.x /= l;
        this.y /= l;
        this.z /= l;
        return this;
    }

    Vector3d.prototype.dot = function(b) {
        return this.x * b.x + this.y * b.y + this.z * b.z;
    }

    Vector3d.prototype.cross = function(b) {
        return new Vector3d(this.y * b.z - b.y * this.z,
            b.x * this.z - this.x * b.z,
            this.x * b.y - b.x * this.y);
    }

    Vector3d.prototype.clone = function() {
        return new Vector3d(this.x, this.y, this.z);
    }

    Vector3d.prototype.distanceFrom = function(b) {
        var dx = b.x - this.x,
            dy = b.y - this.y,
            dz = b.z - this.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    Vector3d.prototype.pitchAndYawTo = function(position) {
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

    Line3d.prototype.distanceToPoint = function(point) {
        var distance = point.distanceFrom(this);
        var aimPoint = this.add(this.direction.multiply(distance));
        return point.distanceFrom(aimPoint);
    }


    /**************************************
     * Entity
     ***************************************/

    var SPROP_COORD = (1 << 1);
    var SPROP_NOSCALE = (1 << 2);
    var SPROP_NORMAL = (1 << 5);
    var SPROP_COORD_MP = (1 << 12);
    var SPROP_COORD_MP_LOWPRECISION = (1 << 13);
    var SPROP_COORD_MP_INTEGRAL = (1 << 14);
    var SPROP_CELL_COORD = (1 << 15);
    var SPROP_CELL_COORD_LOWPRECISION = (1 << 16);
    var SPROP_CELL_COORD_INTEGRAL = (1 << 17);

    function Entity() {
        this.data = {};
        this.serialNumber = null;
        this.classInfo = null;
        this.latestPositionPath = 'csnonlocaldata';
    }

    Entity.prototype.getData = function() {
        return this.data;
    }

    Entity.prototype.readFieldIndex = function(stream, lastIndex, newWay) {

        if (newWay && stream.bits(1)) {
            return lastIndex + 1;
        }

        var ret = 0;
        if (newWay && stream.bits(1)) {
            ret = stream.bits(3);
        } else {
            ret = stream.bits(7);
            switch (ret & (32 | 64)) {
                case 32:
                    ret = (ret & ~96) | (stream.bits(2) << 5);
                    break;
                case 64:
                    ret = (ret & ~96) | (stream.bits(4) << 5);
                    break;
                case 96:
                    ret = (ret & ~96) | (stream.bits(7) << 5);
                    break;
            }
        }
        if (ret == 0xFFF) {
            return -1;
        }
        return lastIndex + 1 + ret;
    }

    Entity.prototype.readFromStream = function(stream) {
        var fieldIndices = [];
        var newWay = stream.bits(1);
        var index = -1;
        do {
            index = this.readFieldIndex(stream, index, newWay);
            if (index != -1) {
                fieldIndices.push(index);
            }
        } while (index != -1);
        var paths = [];
        for (var i = 0; i < fieldIndices.length; i++) {
            paths = paths.concat(this.decodeProperty(stream, fieldIndices[i]));
        }
        return paths;
    }

    Entity.prototype.getValue = function(path) {
        var objPart = this.getObj(this.data, path);
        return objPart.obj[objPart.property];
    }

    Entity.prototype.setValue = function(path, value) {
        var objPart = this.getObj(this.data, path);
        if (objPart.property == 'm_vecOrigin') {
            this.latestPositionPath = path.indexOf('nonlocal') > -1 ?
                'csnonlocaldata' : 'cslocaldata';
        }
        objPart.obj[objPart.property] = value;
    }

    Entity.prototype.getObj = function(data, path) {
        var parts = path.split('.');
        var prop = parts[parts.length - 1];
        for (var i = 0; i < parts.length - 1; i++) {
            if (parts[i] != 'baseclass') {
                if (data[parts[i]] == null) {
                    data[parts[i]] = {};
                }
                data = data[parts[i]];
            }
        }
        return {
            obj: data,
            property: prop
        };
    }

    Entity.prototype.decodeProperty = function(stream, fieldIndex, _property) {

        var flattenedProp = _property || this.classInfo.flattenedProps[fieldIndex];
        if (flattenedProp == null) {
            return null;
        }
        var prop = flattenedProp.prop;
        var paths = [];
        paths.push(flattenedProp.path);
        if (prop) {
            var result = null;
            switch (prop.type) {
                case 0:
                    this.setValue(flattenedProp.path, this.decodeInt(stream, prop));
                    break;
                case 1:
                    this.setValue(flattenedProp.path, this.decodeFloat(stream, prop));
                    break;
                case 2:
                    this.setValue(flattenedProp.path, this.decodeVector(stream, prop));
                    break;
                case 3:
                    this.setValue(flattenedProp.path, this.decodeVectorXY(stream, prop));
                    break;
                case 4:
                    this.setValue(flattenedProp.path, this.decodeString(stream, prop));
                    break;
                case 5:
                    var result = [];
                    var maxElements = prop.numElements;
                    var numBits = 1;
                    while ((maxElements >>= 1) != 0) {
                        numBits++;
                    }
                    var numElements = stream.bits(numBits);
                    for (var i = 0; i < numElements; i++) {
                        var tmp = {
                            'prop': flattenedProp.elm,
                            'path': flattenedProp.path + '.' + i,
                            'elm': null
                        };
                        paths = paths.concat(this.decodeProperty(stream, fieldIndex, tmp));
                    }
                    break;
                default:
                    console.log('sendProp.type = ' + sendProp.type);
                    exit;
                    break;
            }
            return paths;
        }
    }

    Entity.prototype.decodeInt = function(stream, prop) {
        if (prop.flags & (1 << 19)) {
            if (prop.flags & (1 << 0)) {
                return stream.varInt32();
            } else {
                return stream.signedVarInt32();
            }
        } else {
            if (prop.flags & (1 << 0)) {
                return stream.bits(prop.numBits);
            } else {
                return stream.bits(prop.numBits); // hmm
            }
        }
    }

    Entity.prototype.decodeFloat = function(stream, prop) {

        var flags = prop.flags;

        if (flags & SPROP_COORD) {
            return stream.bitCoord();
        } else if (flags & SPROP_COORD_MP) {
            return stream.bitCoordMP(kCW_None);
        } else if (flags & SPROP_COORD_MP_LOWPRECISION) {
            return stream.bitCoordMP(kCW_LowPrecision);
        } else if (flags & SPROP_COORD_MP_INTEGRAL) {
            return stream.bitCoordMP(kCW_Integral);
        } else if (flags & SPROP_NOSCALE) {
            return stream.float();
        } else if (flags & SPROP_NORMAL) {
            return stream.bitNormal();
        } else if (flags & SPROP_CELL_COORD) {
            return stream.bitCellCoord(prop.numBits, kCW_None);
        } else if (flags & SPROP_CELL_COORD_LOWPRECISION) {
            return stream.bitCellCoord(prop.numBits, kCW_LowPrecision);
        } else if (flags & SPROP_CELL_COORD_INTEGRAL) {
            return stream.bitCellCoord(prop.numBits, kCW_Integral);
        }

        var dwInterp = stream.bits(prop.numBits);
        var fVal = 0;
        fVal = dwInterp / ((1 << prop.numBits) - 1);
        fVal = prop.lowValue + (prop.highValue - prop.lowValue) * fVal;
        return fVal;
    }

    Entity.prototype.decodeVector = function(stream, prop) {
        var v = {
            x: this.decodeFloat(stream, prop),
            y: this.decodeFloat(stream, prop)
        };
        if ((prop.flags & (1 << 5)) == 0) {
            v.z = this.decodeFloat(stream, prop);
        } else {
            var v0v0v1v1 = v.x * v.x + v.y * v.y;
            if (v0v0v1v1 < 1) {
                v.z = Math.sqrt(1 - v0v0v1v1);
            } else {
                v.z = 0;
            }
            if (stream.bits(1)) {
                v.z *= -1;
            }
        }
        return v;
    }

    Entity.prototype.decodeVectorXY = function(stream, prop) {
        var vector = {
            x: this.decodeFloat(stream, prop),
            y: this.decodeFloat(stream, prop)
        };
        return vector;
    }

    Entity.prototype.decodeString = function(stream, prop) {
        var len = stream.bits(9);
        if (len == 0) {
            return '';
        }
        var maxBuffer = (1 << 9);
        if (len >= maxBuffer) {
            len = maxBuffer - 1;
        }
        return stream.string(len);
    }

    /*****************************
     * Grenades
     ******************************/

    function Grenade() {
        Entity.call(this);
    }
    inherits(Grenade, Entity);

    function DecoyGrenade() {
        Grenade.call(this);
    }
    inherits(DecoyGrenade, Grenade);

    function HEGrenade() {
        Grenade.call(this);

    }
    inherits(HEGrenade, Grenade);

    function SmokeGrenade() {
        Grenade.call(this);

    }
    inherits(SmokeGrenade, Grenade);

    function Flashbang() {
        Grenade.call(this);

    }
    inherits(Flashbang, Grenade);

    /*****************************
     * Player Entity
     ******************************/

    function Player() {
        Entity.call(this);
        this.info = {};
    }
    inherits(Player, Entity);

    Player.prototype.getName = function() {
        return this.info.name || 'Unknown';
    }

    Player.prototype.isHLTV = function() {
        return this.info.isHLTV || false;
    }

    Player.prototype.isFakePlayer = function() {
        return this.info.fakePlayer || false;
    }

    Player.prototype.getGuid = function() {
        return this.info.guid || '';
    }

    Player.prototype.getUserId = function() {
        return this.info.userId || null;
    }

    Player.prototype.getHealth = function() {
        return this.getValue('m_iHealth') || 100;
    }

    Player.prototype.getTeam = function(demo) {
        var teams = demo.getTeams();
        for (var i = 0; i < teams.length; i++) {
            var team = teams[i];
            if (team.getTeamNumber() == this.getValue('m_iTeamNum')) {
                return team;
            }
        }
    }

    Player.prototype.getEyeAngle = function() {
        var angle0 = this.getValue('m_angEyeAngles[0]');
        var angle1 = this.getValue('m_angEyeAngles[1]');
        return {
            pitch: makeAnglePositive(-(angle0 || 0)),
            yaw: makeAnglePositive(angle1 || 0)
        };
    }

    Player.prototype.getEyeAngleVector = function() {
        var angles = this.getEyeAngle();
        return directionToVector(angles.pitch, angles.yaw);
    }

    Player.prototype.getAimLine = function() {
        var position = this.getPosition();
        var angle = this.getEyeAngleVector();
        return new Line3d(position.x, position.y, position.z, angle);
    }

    Player.prototype.getAimDistanceTo = function(player) {
        return this.getAimLine().distanceToPoint(player.getPosition());
    }

    Player.prototype.getAimPunchAngle = function() {
        return this.getValue('localdata.m_Local.m_aimPunchAngle') || {
            x: 0,
            y: 0,
            z: 0
        };
    }

    Player.prototype.getPosition = function() {
        var xy = this.getValue(this.latestPositionPath + '.m_vecOrigin');
        var z = this.getValue(this.latestPositionPath + '.m_vecOrigin[2]');
        if (xy != null && z !== null) {
            return new Vector3d(xy.x, xy.y, z);
        }
        return new Vector3d();
    }

    Player.prototype.getArmorValue = function() {
        return this.getValue('m_ArmorValue') || 0;
    }

    Player.prototype.hasHelmet = function() {
        return this.getValue('m_bHasFelmet') == 1;
    }

    Player.prototype.getCurrentEquipmentValue = function() {
        return this.getValue('m_unCurrentEquipmentValue') || 0;
    }

    Player.prototype.isSpotted = function() {
        return this.getValue('m_bSpotted') == 1;
    }

    Player.prototype.getRoundStartCash = function() {
        return this.getValue('m_iStartAccount') || 0;
    }

    Player.prototype.getCurrentCash = function() {
        return this.getValue('m_iAccount') || 0;
    }

    Player.prototype.getLastPlaceName = function() {
        return this.getValue('m_szLastPlaceName') || '';
    }

    Player.prototype.getRoundKills = function() {
        return this.getValue('m_iNumRoundKills') || 0;
    }

    Player.prototype.getRoundHeadshotKills = function() {
        return this.getValue('m_iNumRoundKillsHeadshots') || 0;
    }

    Player.prototype.isScoped = function() {
        return this.getValue('m_bIsScoped') == 1;
    }

    Player.prototype.isWalking = function() {
        return this.getValue('m_bIsWalking') == 1;
    }

    Player.prototype.hasDefuser = function() {
        return this.getValue('m_bHasDefuser') == 1;
    }

    /*****************************
     * Teams
     ******************************/

    function Team() {
        Entity.call(this);
    }
    inherits(Team, Entity);

    Team.prototype.getTeamNumber = function() {
        return this.getValue('m_iTeamNum');
    }

    Team.prototype.getSide = function() {
        return (this.getValue('m_szTeamname') || '').toUpperCase();
    }

    Team.prototype.getClanName = function() {
        return this.getValue('m_szClanTeamname');
    }

    Team.prototype.getFlag = function() {
        return this.getValue('m_szTeamFlagImage');
    }

    Team.prototype.getScore = function() {
        return this.getValue('m_scoreTotal') || 0;
    }

    Team.prototype.getScoreFirstHalf = function() {
        return this.getValue('m_scoreFirstHalf') || 0;
    }

    Team.prototype.getScoreSecondHalf = function() {
        return this.getValue('m_scoreSecondHalf') || 0;
    }

    Team.prototype.getPlayers = function(demo) {
        var d = this.getValue('"player_array"') || {};
        console.log(d);
        var players = [];
        for (var k in d) {
            players.push(demo.findEntityById(d[k]));
        }
        return players;
    }


    /*****************************/

    var entityClassMap = {
        'DT_CSPlayer': Player,
        'DT_CSTeam': Team,
        'DT_DecoyGrenade': DecoyGrenade,
        'DT_HEGrenade': HEGrenade,
        'DT_Flashbang': Flashbang,
        'DT_SmokeGrenade': SmokeGrenade
    }

    //m_bSpottedByMask <-- hmm


    /**************************************
     * Demo
     ***************************************/

    var CMD_SIGNON = 1;
    var CMD_PACKET = 2;
    var CMD_SYNC_TICK = 3;
    var CMD_CONSOLE_CMD = 4;
    var CMD_USER_CMD = 5;
    var CMD_DATA_TABLES = 6;
    var CMD_STOP = 7;
    var CMD_CUSTOM = 8;
    var CMD_STRING_TABLES = 9;

    var MSG_SERVER_INFO = 8;
    var MSG_DATA_TABLE = 9;
    var MSG_CREATE_STRING_TABLE = 12;
    var MSG_UPDATE_STRING_TABLE = 13;
    var MSG_USER_MESSAGE = 23;
    var MSG_GAME_EVENT = 25;
    var MSG_PACKET_ENTITIES = 26;
    var MSG_GAME_EVENTS_LIST = 30;

    var PVS_ENTER = 0;
    var PVS_LEAVE = 1;
    var DELTA_ENT = 2;
    var PRESERVE_ENT = 3;

    function Demo() {
        this.commandHandlers = [];
        this.serverClasses = [];
        this.players = [];
        this.entities = [];
        this.serverClassesLoaded = false;
        this.classCachePath = null;
        this.dataTables = null;
        this.stringTables = [];
        this.gameEventDescriptors = [];
        this.tick = 0;
        EventEmitter.call(this, {
            wildcard: true
        });
    }

    inherits(Demo, EventEmitter);

    Demo.prototype.parse = function(buffer) {

        var stream = null;

        if (buffer instanceof BitStream) {
            stream = buffer;
        } else {
            stream = new BitStream(buffer);
        }

        var cmd, running = true;

        demoHeader = {
            'filestamp': stream.string(8),
            'demoProtocol': stream.int32(),
            'networkProtocol': stream.int32(),
            'serverName': stream.string(260),
            'clientName': stream.string(260),
            'mapName': stream.string(260),
            'gameDirectory': stream.string(260),
            'playbackTime': stream.float(),
            'playbackTicks': stream.int32(),
            'playbackFrames': stream.int32(),
            'signOnLength': stream.int32()
        };

        this.emit('demo_header', demoHeader);

        while (running) {

            var command = stream.byte();
            this.tick = stream.int32();
            if (command != 2) {
                this.tick = 0;
            }
            if (this.tick > 0) {
                this.emit('tick', this.tick);
            }

            stream.skip(1);

            switch (command) {
                case CMD_SIGNON:
                case CMD_PACKET:
                    this.parsePacket(stream);
                    break;

                case CMD_DATA_TABLES:
                    this.parseDataTables(stream);
                    break;

                case CMD_USER_CMD:
                    stream.skip(4);
                    stream.skip(stream.int32());
                    break;

                case CMD_STRING_TABLES:
                    this.parseStringTables(stream);
                    break;

                case CMD_STOP:
                    running = false;
                    this.emit('end');
                    break;

                case CMD_CUSTOM:
                case CMD_CONSOLE_CMD:
                    stream.skip(stream.int32());
                default:
            }

            if (this.tick > 0) {
                this.emit('tick_end', this.tick);
            }
        }
    }

    Demo.prototype.parseStringTables = function(stream) {

        var size = stream.int32();
        var destination = stream.tell() + size;

        var numTables = stream.byte();

        for (var i = 0; i < numTables; i++) {

            var tableName = stream.string(4096, true);
            var isUserTable = tableName == 'userinfo';
            var numStrings = stream.int16();

            if (isUserTable) {
                this.players = [];
            }

            for (var j = 0; j < numStrings; j++) {

                var string = stream.string(4096, true);

                if (stream.bits(1)) {

                    var userDataSize = stream.int16();
                    var postReadDest = stream.tellBits() + (userDataSize * 8);

                    if (isUserTable) {
                        var player = this.readPlayer(stream);
                        this.addPlayer(player);
                    }
                    stream.seekBits(postReadDest);
                }
            }
            if (isUserTable) break;
            stream.bits(1);
        }

        stream.seek(destination);
    }

    Demo.prototype.readPlayer = function(stream) {
        stream.skip(16);
        var player = {
            'name': stream.string(128),
            'userId': (function() {
                var val = stream.int32();
                return ((val >> 24) & 0xff) |
                    ((val << 8) & 0xff0000) |
                    ((val >> 8) & 0xff00) |
                    ((val << 24) & 0xff000000);
            })(),
            'guid': stream.string(36),
            'fakePlayer': stream.skip(132).bool(),
            'isHLTV': stream.bool()
        };
        stream.skip(22);
        return player;
    }

    Demo.prototype.parsePacket = function(stream) {
        stream.skip(160);
        var chunkSize = stream.int32();
        var offset = stream.tell();
        while (stream.tell() < offset + chunkSize) {
            var message = this.parseProtobufMessage(stream);
            if (message != null) {
                switch (message.messageType) {

                    case MSG_SERVER_INFO:
                        this.emit('server_info', message);
                        break;

                    case MSG_CREATE_STRING_TABLE:
                        if (message.name == 'userinfo') {
                            this.parseStringTableUpdate(message.data,
                                message.numEntries,
                                message.maxEntries,
                                message.userDataSize,
                                message.userDataSizeBits,
                                message.userDataFixedSize);
                        }
                        this.stringTables.push({
                            name: message.name,
                            maxEntries: message.maxEntries
                        });
                        break;

                    case MSG_UPDATE_STRING_TABLE:
                        var stringTable = this.stringTables[message.tableId];
                        if (stringTable != null && stringTable.name == 'userinfo' && message.numChangedEntries < stringTable.maxEntries) {
                            this.parseStringTableUpdate(
                                message.data,
                                message.numChangedEntries,
                                stringTable.maxEntries,
                                0, 0, 0, true
                            );
                        }
                        break;

                    case MSG_PACKET_ENTITIES:
                        this.handlePacketEntities(message);
                        break;

                    case MSG_USER_MESSAGE:
                        switch (message.userMessageType) {
                            case 6:
                                this.emit('chat_message', message.data);
                                break;
                        }
                        break;

                    case MSG_GAME_EVENT:
                        this.handleGameEvent(message);
                        break;

                    case MSG_GAME_EVENTS_LIST:
                        this.handleGameEventsList(message);
                        break;
                }
            }
        }
    }

    Demo.prototype.handlePacketEntities = function(message) {
        var headerCount = message.updatedEntities;
        var updateFlags = 0;
        var headerBase = -1;
        var entityId = -1;
        var updateType = PRESERVE_ENT;
        var data = message.entityData;
        while (updateType < 4) {
            var isEntity = --headerCount >= 0;
            if (isEntity) {
                updateFlags = 0;
                entityId = headerBase + 1 + data.uBitVar();
                headerBase = entityId;
                if (!data.bits(1)) {
                    if (data.bits(1)) {
                        updateFlags |= 4;
                    }
                } else {
                    updateFlags |= 1;
                    if (data.bits(1)) {
                        updateFlags |= 2;
                    }
                }
            }
            for (updateType = PRESERVE_ENT; updateType == PRESERVE_ENT;) {
                if (!isEntity || entityId > 9999) {
                    updateType = 4;
                } else {
                    if (updateFlags & 4) {
                        updateType = PVS_ENTER;
                    } else if (updateFlags & 1) {
                        updateType = PVS_LEAVE;
                    } else {
                        updateType = DELTA_ENT;
                    }
                }
                switch (updateType) {
                    case PVS_ENTER:
                        var classIndex = data.bits(this.serverClassBits);
                        var serialNum = data.bits(10);
                        var entity = this.addEntity(entityId, this.serverClasses[classIndex], serialNum);
                        var paths = entity.readFromStream(data);
                        this.emit('entity_added', entity);
                        this.emit('entity_updated', entity, paths);
                        break;
                    case PVS_LEAVE:
                        var removed = this.removeEntity(entityId);
                        this.emit('entity_removed', removed);
                        break;
                    case DELTA_ENT:
                        var entity = this.findEntityById(entityId);
                        if (entity != null) {
                            var paths = entity.readFromStream(data);
                            this.emit('entity_updated', entity, paths);
                        } else {
                            console.log('cant find entity ' + entityId);
                            return;
                        }
                        break;
                }
            }
        }
    }

    Demo.prototype.addEntity = function(entityId, classInfo, serialNumber) {
        var entity = this.findEntityById(entityId);
        if (entity == null) {
            var klazz = entityClassMap[classInfo.dataTableName];
            if (klazz == null) {
                klazz = Entity;
            }
            entity = new klazz();
            entity.entityId = entityId;
            this.entities.push(entity);
        }
        if (entity instanceof Player) {
            entity.info = this.players[entity.entityId - 1];
        }
        entity.classInfo = classInfo;
        entity.serialNumber = serialNumber;
        return entity;
    }

    Demo.prototype.removeEntity = function(entityId) {
        var i = this.entities.length;
        while (i--) {
            if (this.entities[i].entityId == entityId) {
                return this.entities.splice(i, 1)[0];
            }
        }
    }

    Demo.prototype.handleGameEventsList = function(message) {
        for (var i = 0; i < message.descriptors.length; i++) {
            var descriptor = message.descriptors[i];
            this.gameEventDescriptors[descriptor.eventId] = descriptor;
        }
    }

    Demo.prototype.handleGameEvent = function(message) {

        if (this.gameEventDescriptors[message.eventId] != null) {

            var description = this.gameEventDescriptors[message.eventId];

            var params = {};
            if (description.keys != null) {
                for (var i = 0; i < description.keys.length; i++) {
                    var key = description.keys[i];
                    params[key.name] = message.values[i].value;
                }
            }

            switch (description.name) {

                case 'player_connect':
                    var player = {
                        'name': params.name,
                        'userId': params.userid,
                        'guid': params.networkid,
                        'fakePlayer': params.networkid == 'BOT',
                        'isHLTV': false
                    };
                    this.addPlayer(player, params.index);
                    break;

                case 'player_disconnect':
                    var entity = this.findEntityByUserId(params.userid);
                    params = {
                        reason: params.reason,
                        player: entity
                    }
                    break;
            }

            if (params.userid != null) {
                params.player = this.findEntityByUserId(params.userid);
                delete params.userid;
            }

            if (params.attacker != null) {
                params.attacker = this.findEntityByUserId(params.attacker);
            }

            if (params.assister != null) {
                params.assister = this.findEntityByUserId(params.assister);
            }

            this.emit('game.' + description.name, params);

            if (description.name == 'player_disconnect') {
                if (player != null) {
                    player.info.connected = false;
                    player.info.userId = -1;
                }
            }
        }
    }

    Demo.prototype.parseProtobufMessage = function(stream) {
        var messageType = stream.varInt32();
        var message = null;
        switch (messageType) {
            case MSG_SERVER_INFO:
                message = stream.protobuf(function(def) {
                    def.addField(1, 'protocol', 'varInt32').
                    addField(2, 'serverCount', 'varInt32').
                    addField(3, 'isDedicated', 'varInt32Bool').
                    addField(4, 'isOfficialValveServer', 'varInt32Bool').
                    addField(5, 'isHLTV', 'varInt32Bool').
                    addField(6, 'isReplay', 'varInt32Bool').
                    addField(7, 'cOs', 'varInt32').
                    addField(8, 'mapCrc', 'int32').
                    addField(9, 'clientCrc', 'int32').
                    addField(10, 'stringTableCrc', 'int32').
                    addField(11, 'maxClients', 'varInt32').
                    addField(12, 'maxClasses', 'varInt32').
                    addField(13, 'playerSlot', 'varInt32').
                    addField(14, 'tickInterval', 'float').
                    addField(15, 'gameDirectory', 'vString').
                    addField(16, 'mapName', 'vString').
                    addField(17, 'mapGroupName', 'vString').
                    addField(18, 'skyName', 'vString').
                    addField(19, 'hostName', 'vString').
                    addField(21, 'isRedirectingToProxyRelay', 'varInt32Bool').
                    addField(22, 'ugcMapId', 'bytes', [8]);
                });
                break;
            case MSG_DATA_TABLE:
                message = stream.protobuf(function(def) {
                    def.addField(1, 'isEnd', 'varInt32Bool').
                    addField(2, 'netTableName', 'vString').
                    addField(3, 'needsDecoder', 'varInt32Bool').
                    addField(4, 'props', function() {
                        return stream.protobuf(function(propdef) {
                            propdef.addField(1, 'type', 'varInt32').
                            addField(2, 'varName', 'vString').
                            addField(3, 'flags', 'varInt32').
                            addField(4, 'priority', 'varInt32').
                            addField(5, 'dataTableName', 'vString').
                            addField(6, 'numElements', 'varInt32').
                            addField(7, 'lowValue', 'float').
                            addField(8, 'highValue', 'float').
                            addField(9, 'numBits', 'varInt32')
                        });
                    }, null, 'array');
                });
                break;
            case MSG_CREATE_STRING_TABLE:
                message = stream.protobuf(function(def) {
                    def.addField(1, 'name', 'vString').
                    addField(2, 'maxEntries', 'varInt32').
                    addField(3, 'numEntries', 'varInt32').
                    addField(4, 'userDataFixedSize', 'varInt32Bool').
                    addField(5, 'userDataSize', 'varInt32').
                    addField(6, 'userDataSizeBits', 'varInt32').
                    addField(7, 'flags', 'varInt32').
                    addField(8, 'data', 'vChunk');
                });
                break;
            case MSG_UPDATE_STRING_TABLE:
                message = stream.protobuf(function(def) {
                    def.addField(1, 'tableId', 'varInt32').
                    addField(2, 'numChangedEntries', 'varInt32').
                    addField(3, 'data', 'vChunk');
                });
                break;
            case MSG_PACKET_ENTITIES:
                message = stream.protobuf(function(def) {
                    def.addField(1, 'maxEntities', 'varInt32').
                    addField(2, 'updatedEntities', 'varInt32').
                    addField(3, 'isDelta', 'varInt32Bool').
                    addField(4, 'updateBaseline', 'varInt32Bool').
                    addField(5, 'baseline', 'varInt32').
                    addField(6, 'deltaFrom', 'varInt32').
                    addField(7, 'entityData', 'vChunk');
                });
                break;
            case MSG_USER_MESSAGE:
                message = stream.protobuf(function(def) {
                    def.addField(1, 'userMessageType', 'varInt32').
                    addField(2, 'data', 'vChunk');
                });
                switch (message.userMessageType) {
                    case 5:
                        message.data = message.data.protobuf(function(def) {
                            def.addField(1, 'entityId', 'varInt32').
                            addField(2, 'text', 'vString').
                            addField(5, 'chat', 'varInt32Bool').
                            addField(5, 'textChatAll', 'varInt32Bool');
                        }, message.data.size);
                        break;
                    case 6:
                        message.data = message.data.protobuf(function(def) {
                            def.addField(1, 'entityId', 'varInt32').
                            addField(2, 'chat', 'varInt32Bool').
                            addField(3, 'messageName', 'vString').
                            addField(4, 'params', 'vString', null, 'array').
                            addField(5, 'textChatAll', 'varInt32Bool');
                        }, message.data.size);
                        break;
                }
                break;
            case MSG_GAME_EVENT:
                message = stream.protobuf(function(def) {
                    def.addField(1, 'eventName', 'vString').
                    addField(2, 'eventId', 'varInt32').
                    addField(3, 'values', function() {
                        return stream.protobuf(function(keysDef) {
                            keysDef.addField(1, 'type', 'varInt32').
                            addField(2, 'value', 'vString').
                            addField(3, 'value', 'float').
                            addField(4, 'value', 'varInt32').
                            addField(5, 'value', 'varInt32').
                            addField(6, 'value', 'varInt32').
                            addField(7, 'value', 'varInt32Bool').
                            addField(8, 'value', 'varInt64').
                            addField(9, 'value', 'vChunk')
                        });
                    }, null, 'array');
                });
                break;
            case MSG_GAME_EVENTS_LIST:
                message = stream.protobuf(function(def) {
                    def.addField(1, 'descriptors', function() {
                        return stream.protobuf(function(descDef) {
                            descDef.addField(1, 'eventId', 'varInt32').
                            addField(2, 'name', 'vString').
                            addField(3, 'keys', function() {
                                return stream.protobuf(function(keyDef) {
                                    keyDef.addField(1, 'type', 'varInt32').
                                    addField(2, 'name', 'vString');
                                });
                            }, null, 'array');
                        });
                    }, null, 'array');
                });
                break;
            default:
                stream.skip(stream.varInt32());

        }

        if (message != null) {
            message.messageType = messageType;
        }

        return message;
    }

    Demo.prototype.parseStringTableUpdate = function(stream, numEntries, maxEntries, userDataSize, userDataSizeBits, userDataFixedSize) {

        var lastEntry = -1;
        var lastDictionaryIndex = -1;
        var nTemp = maxEntries;
        var entryBits = 0;

        while (nTemp >>= 1) {
            ++entryBits;
        }

        if (stream.bits(1)) {
            return;
        }

        var bitDebug = stream.tellBits();

        for (var i = 0; i < numEntries; i++) {

            var entryIndex = lastEntry + 1;

            if (!stream.bits(1)) {
                entryIndex = stream.bits(entryBits);
            }

            lastEntry = entryIndex;

            if (entryIndex < 0 || entryIndex > maxEntries) {
                return;
            }

            var entry = '';
            if (stream.bits(1)) {
                if (stream.bits(1)) {
                    var index = stream.bits(5);
                    var bytestocopy = stream.bits(5);
                    entry = stream.string(100000, true);
                } else {
                    entry = stream.string(100000, true);
                }
            }

            var userData = '';
            var size = 0;

            if (stream.bits(1)) {
                if (userDataFixedSize) {
                    size = userDataSizeBits;
                } else {
                    var sizeBytes = stream.bits(14);
                    size = sizeBytes * 8;
                }
            }

            var currentBits = stream.tellBits();

            if (size > 0) {
                var player = this.readPlayer(stream);
                this.addPlayer(player, entryIndex);
            }

            stream.seekBits(currentBits + size);

        }
    }

    Demo.prototype.gatherProps = function(serverClass, dataTable, excludes, path) {
        var tmp = [];
        this.iterateProps(serverClass, dataTable, tmp, excludes, path);
        for (var i = 0; i < tmp.length; i++) {
            serverClass.flattenedProps.push(tmp[i]);
        }
    }

    Demo.prototype.iterateProps = function(serverClass, dataTable, props, excludes, path) {

        path = path || '';

        if (dataTable.props == null) {
            return;
        }

        for (var i = 0; i < dataTable.props.length; i++) {

            var prop = dataTable.props[i];

            if ((prop.flags & (1 << 8)) ||
                (prop.flags & (1 << 6)) ||
                this.isPropExcluded(dataTable, prop, excludes)) {
                continue;
            }

            var propPath = prop.varName == 'baseclass' ?
                '' : prop.varName;

            if (propPath != '' && path != '') {
                propPath = path + '.' + propPath;
            }

            if (prop.type == 6) {

                var subTable = this.findDataTable(prop.dataTableName);

                if (prop.flags & (1 << 11)) {
                    this.iterateProps(serverClass, subTable, props, excludes, propPath);
                } else {
                    this.gatherProps(serverClass, subTable, excludes, propPath);
                }

            } else if (prop.type == 5) {

                props.push({
                    path: propPath,
                    prop: prop,
                    elm: dataTable.props[i - 1]
                });

            } else {

                props.push({
                    path: propPath,
                    prop: prop
                });

            }
        }
    }

    Demo.prototype.gatherExcludes = function(dataTable, excludes) {

        var excludes = excludes || [];

        if (dataTable.props != null) {
            for (var i = 0; i < dataTable.props.length; i++) {
                var prop = dataTable.props[i];
                if (prop.flags & (1 << 6)) {
                    excludes.push({
                        varName: prop.varName,
                        dataTableName: prop.dataTableName,
                        netTableName: dataTable.netTableName
                    });
                }
                if (prop.type == 6) {
                    var subTable = this.findDataTable(prop.dataTableName);
                    if (subTable != null) {
                        this.gatherExcludes(subTable, excludes);
                    }
                }
            }
        }

        return excludes;
    }

    Demo.prototype.findDataTable = function(name) {
        for (var j = 0; j < this.dataTables.length; j++) {
            if (this.dataTables[j].netTableName == name) {
                return this.dataTables[j];
            }
        }
    }

    Demo.prototype.isPropExcluded = function(dataTable, prop, excludes) {

        for (var i = 0; i < excludes.length; i++) {
            if (dataTable.netTableName == excludes[i].dataTableName &&
                prop.varName == excludes[i].varName) {
                return true;
            }
        }

        return false;
    }

    Demo.prototype.sortProps = function(flattened) {
        var priorities = [];
        priorities.push(64);

        for (var i = 0; i < flattened.length; i++) {
            var prop = flattened[i].prop;
            if (priorities.indexOf(prop.priority) == -1) {
                priorities.push(prop.priority);
            }
        }

        priorities.sort(function(a, b) {
            return a - b
        });

        var start = 0;
        for (var priority_index = 0; priority_index < priorities.length; priority_index++) {
            var priority = priorities[priority_index];
            while (true) {
                var currentProp = start;
                while (currentProp < flattened.length) {
                    var prop = flattened[currentProp].prop;
                    if (prop.priority == priority || (priority == 64 && ((1 << 18) & prop.flags))) {
                        if (start != currentProp) {
                            var temp = flattened[start];
                            flattened[start] = flattened[currentProp];
                            flattened[currentProp] = temp;
                        }
                        start++;
                        break;
                    }
                    currentProp++;
                }
                if (currentProp == flattened.length) {
                    break;
                }
            }
        }
    }

    Demo.prototype.parseDataTables = function(stream) {

        var size = stream.int32();
        var destination = stream.tell() + size;
        var message = null;
        this.dataTables = [];

        while (true) {
            message = this.parseProtobufMessage(stream);
            if (message.isEnd) {
                break;
            } else {
                this.dataTables.push(message);
            }
        }

        var numServerClasses = stream.int16();

        for (var i = 0; i < numServerClasses; i++) {

            var serverClass = {
                'classId': stream.int16(),
                'name': stream.string(256, true),
                'dataTableName': stream.string(256, true),
                'flattenedProps': []
            };

            serverClass.dataTable = this.findDataTable(serverClass.dataTableName);
            var excludes = this.gatherExcludes(serverClass.dataTable);
            this.gatherProps(serverClass, serverClass.dataTable, excludes);
            this.sortProps(serverClass.flattenedProps);
            this.serverClasses.push(serverClass);

        }

        this.serverClassBits = 0;
        while (numServerClasses >>= 1) ++this.serverClassBits;
        this.serverClassBits++;
    }

    Demo.prototype.addPlayer = function(player, index) {
        if (typeof index !== 'undefined' && index < this.players.length) {
            if (this.players[index].userId != player.userId) {
                this.players[index] = player;
            }
        } else {
            this.players.push(player);
        }
    }

    Demo.prototype.findPlayerById = function(userId) {
        var index = this.findPlayerIndex(userId);
        if (index > -1) {
            return this.players[index];
        }
        return null;
    }

    Demo.prototype.findPlayerIndex = function(userId) {
        for (var i = 0; i < this.players.length; i++) {
            if (this.players[i].userId == userId) {
                return i;
            }
        }
        return -1;
    }

    Demo.prototype.findPlayerByName = function(name) {
        var players = this.getPlayers();
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            if (player.getName() == name) {
                return player;
            }
        }
    }

    Demo.prototype.findEntityByUserId = function(userId) {
        var index = this.findPlayerIndex(userId);
        if (index > -1) {
            return this.findEntityById(index + 1);
        }
        return null;
    }

    Demo.prototype.findEntityById = function(entityId) {
        for (var i = 0; i < this.entities.length; i++) {
            if (this.entities[i].entityId == entityId) {
                return this.entities[i];
            }
        }
    }


    Demo.prototype.getTick = function() {
        return this.tick;
    }

    Demo.prototype.getEntities = function(entityClass) {
        var selectedEntities = [];
        for (var i = 0; i < this.entities.length; i++) {
            var entity = this.entities[i];
            if (entityClass == null ||
                entity.classInfo.dataTableName == entityClass ||
                (typeof(entityClass) == 'function' &&
                    entity instanceof entityClass)) {

                selectedEntities.push(entity);
            }
        }
        return selectedEntities;
    }

    Demo.prototype.getTeams = function() {
        return this.getEntities(Team);
    }

    Demo.prototype.getRound = function() {
        var teams = this.getTeams();
        var rounds = 0;
        for (var i = 0; i < teams.length; i++) {
            var team = teams[i];
            rounds += team.getScore();
        }
        return rounds + 1;
    }

    Demo.prototype.getPlayers = function() {
        return this.getEntities(Player);
    }

    var exports = {
        BitStream: BitStream,
        Demo: Demo,
        Team: Team,
        Player: Player,
        Grenade: Grenade,
        HEGrenade: HEGrenade,
        Flashbang: Flashbang,
        SmokeGrenade: SmokeGrenade,
        DecoyGrenade: DecoyGrenade,
        Vector3d: Vector3d,
        inherits: inherits
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
        root.jsgo = exports;
    }
    root.jsgo = exports;

})();