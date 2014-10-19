var eventValueTypes = [
    'val_string', 'val_float', 'val_long', 'val_short',
    'val_byte', 'val_bool', 'val_uint64', 'val_wstring'
]

var header = function(stream) {
    return {

        'filestamp': stream.getTerminatedString(8),
        'demoprotocol': stream.getInt32(),
        'networkprotocol': stream.getInt32(),
        'servername': stream.getTerminatedString(260),
        'clientname': stream.getTerminatedString(260),
        'mapname': stream.getTerminatedString(260),
        'gamedirectory': stream.getTerminatedString(260),
        'playback_time': stream.getFloat32(),
        'playback_ticks': stream.getInt32(),
        'playback_frames': stream.getInt32(),
        'signonlength': stream.getInt32()

    }
};

var cmdHeader = function(stream) {
    return {

        'cmd': stream.getUint8(),
        'tick': stream.getInt32(),
        'player_slot': stream.getUint8()

    }
};

var serverClass = function(stream) {
    return {
        'nClassID': stream.getInt16(),
        'strName': stream.getTerminatedString(256, true),
        'strDTName': stream.getTerminatedString(256, true),
        'dataTable': null,
        'flattenedProps': []
    }
};

var Player = function() {

    this.connected = true;
    this.name = null;
    this.userID = null;
    this.guid = null;
    this.fakePlayer = null;
    this.isHLTV = null;

    this.readFromStream = function(stream) {
        stream.skip(16);
        this.name = stream.getTerminatedString(128);
        this.userID = stream.getInt32(undefined, false);
        this.guid = stream.getTerminatedString(36);
        stream.skip(132);
        this.fakePlayer = stream.getUint8() ? true : false;
        this.isHLTV = stream.getUint8() ? true : false;
        stream.skip(17);
    }
}

var classes = {};
classes.header = header;
classes.cmdHeader = cmdHeader;
classes.serverClass = serverClass;
classes.Player = Player;