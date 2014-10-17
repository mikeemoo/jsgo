var Demo = function() {

    var processingInterval = null;
    var self = this;

    var dataTables = [];
    var serverClasses = [];
    var players = [];
    var nServerClassBits = 0;
    var gameEventDescList = [];
    var entities = [];
    var currentExcludes = [];


    var builder = dcodeIO.ProtoBuf.loadProtoFile('./netmessages_public.proto');
    dcodeIO.ProtoBuf.loadProtoFile('./usermessages_public.proto', null, builder);

    var netMessageTypes = {
        SendTable: {
            id: 9,
            msg: builder.build('CSVCMsg_SendTable'),
            handler: function(msg) {}
        },

        GameEventList: {
            id: 30,
            msg: builder.build('CSVCMsg_GameEventList'),
            handler: function(msg) {
                msg.descriptors.forEach(function(evt) {
                    gameEventDescList[evt.eventid] = evt;
                });
            }
        },
        GameEvent: {
            id: 25,
            msg: builder.build('CSVCMsg_GameEvent'),
            handler: function(msg) {
                var eventDesc = gameEventDescList[msg.eventid];
                if (eventDesc != null) {
                    var name = eventDesc.name;
                    var params = {};
                    for (var i = 0; i < eventDesc.keys.length; i++) {
                        var dk = eventDesc.keys[i];
                        var ek = msg.keys[i];
                        params[dk.name] = ek[eventValueTypes[ek.type - 1]];
                    }
                    switch (name) {
                        case 'player_connect':
                            var player = new classes.Player();
                            player.name = params.name;
                            player.guid = params.networkid;
                            player.fakePlayer = false;
                            player.isHLTV = false;
                            if (params.networkid == 'BOT') {
                                player.fakePlayer = true;
                            }
                            player.userID = params.userid;
                            if (params.index == null) {
                                players.push(player);
                            } else {
                                if (players[params.index] == null || players[params.index].userID != player.userID) {
                                    players[params.index] = player;
                                }
                            }
                            params = player;

                            break;
                        case 'player_disconnect':
                            var player = findPlayer(params.userid);
                            if (player != null) {
                                player.connected = false;
                            }
                            params = {
                                'reason': params.reason,
                                'player': player
                            };

                            break;
                    }
                    self.emit(name, params);
                }
            }
        },
        UserMessage: {
            id: 23,
            msg: builder.build('CSVCMsg_UserMessage'),
            handler: function(msg) {
                // dont do anything yet
            }
        },
        PacketEntities: {
            id: 26,
            msg: builder.build('CSVCMsg_PacketEntities'),
            handler: function(msg) {
                var bitView = new BitView(msg.entity_data.buffer);
                var bitStream = new BitStream(bitView);
                var nHeaderCount = msg.updated_entries;
                bitStream._index += msg.entity_data.offset * 8;
                var updateFlags = 0;
                var nHeaderBase = -1;
                var entityId = -1;
                var asDelta = msg.is_delta;

                var updateType = 3;
                while (updateType < 4) {
                    nHeaderCount--;
                    var isEntity = nHeaderCount >= 0;
                    if (isEntity) {
                        updateFlags = 0;
                        entityId = nHeaderBase + 1 + bitStream.readUBitVar();
                        nHeaderBase = entityId;
                        if (bitStream.readBits(1) == 0) {
                            if (bitStream.readBits(1) != 0) {
                                updateFlags |= 4;
                            }
                        } else {
                            updateFlags |= 1;
                            if (bitStream.readBits(1) != 0) {
                                updateFlags |= 2;
                            }
                        }
                    }
                    for (updateType = 3; updateType == 3;) {
                        if (!isEntity || entityId > 9999) {
                            updateType = 4;
                        } else {
                            if (updateFlags & 4) {
                                updateType = 0; // EnterPVS
                            } else if (updateFlags & 1) {
                                updateType = 1; // LeavePVS
                            } else {
                                updateType = 2; // DeltaEnt
                            }
                        }
                        switch (updateType) {
                            case 0: // EnterPVS
                                var classIndex = bitStream.readBits(nServerClassBits, false);
                                var uSerialNum = bitStream.readBits(10, false);

                                var entity = addEntity(entityId, serverClasses[classIndex], uSerialNum);
								var paths = entity.readFromStream(bitStream);
                                self.emit('entity_added', entity);
                                self.emit('entity_updated', entity, paths);
                                break;
                            case 1: // LeavePVS
                                removeEntity(entityId);
                                self.emit('entity_removed', entityId);
                                break;
                            case 2: // DeltaEnt
                                var entity = findEntity(entityId);
                                if (entity) {
									var paths = entity.readFromStream(bitStream);
									self.emit('entity_updated', entity,  paths);
                                } else {
                                    console.log('unable to find entity ' + nNewEntity);
                                    exit;
                                }
                                break;
                            case 3: // PreserveEnt
                                if (!asDelta) {
                                    console.log('leavePVS on full update');
                                    exit;
                                } else {
                                    if (entityId >= (1 << 11)) {
                                        console.log("PreserveEnt: nNewEntity == MAX_EDICTS");
                                        exit;
                                    }
                                }
                                break;
                            default:
                                break;
                        }
                    }
                }
            }
        }
    };

    function findPlayer(userId) {
        return _.findWhere(players, {
            userID: userId
        });
    }

	function findPlayerEntity(userId) {
		return entities[userId - 1];
	}

    function gatherExcludes(table) {
        for (var i = 0; i < table.props.length; i++) {
            var prop = table.props[i];
            if (prop.flags & (1 << 6)) {
                currentExcludes.push({
                    var_name: prop.var_name,
                    dt_name: prop.dt_name,
                    net_table_name: table.net_table_name
                });
            }
            if (prop.type == 6) {
                if (subTable = _.findWhere(dataTables, {
                        net_table_name: prop.dt_name
                    })) {
                    gatherExcludes(subTable);
                }
            }
        }
    }

    function isPropExcluded(table, prop) {
        for (var i = 0; i < currentExcludes.length; i++) {
            if (table.net_table_name == currentExcludes[i].dt_name &&
                prop.var_name == currentExcludes[i].var_name) {
                return true;
            }
        }
        return false;
    }

    function gatherProps(table, serverClass, path) {
        var tmp = [];
        iterateProps(table, serverClass, tmp, path);
        for (var i = 0; i < tmp.length; i++) {
            serverClass.flattenedProps.push(tmp[i]);
        }
    }

    function iterateProps(table, serverClass, props, path) {

        path = path || '';

        for (var i = 0; i < table.props.length; i++) {
            var prop = table.props[i];
            if ((prop.flags & (1 << 8)) ||
                (prop.flags & (1 << 6)) ||
                isPropExcluded(table, prop)) {
                continue;
            }
            var propPath = prop.var_name;
            if (propPath == 'baseclass') {
				propPath = '';
			}
            if (propPath != '' && path != '') {
                propPath = path + '.' + propPath;
            }

            if (prop.type == 6) {
                var subTable = _.findWhere(dataTables, {
                    net_table_name: prop.dt_name
                });
                if (prop.flags & (1 << 11)) {
                    iterateProps(subTable, serverClass, props, propPath);
                } else {
                    gatherProps(subTable, serverClass, propPath);
                }
            } else if (prop.type == 5) {
                props.push({
                    'path': propPath,
                    'prop': prop,
                    'elm': table.props[i - 1]
                });
            } else {
                props.push({
                    'path': propPath,
                    'prop': prop
                });
            }
        }
    }

    function sortProps(flattened) {

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

    function findEntity(entityId) {
		for (var i = 0; i < entities.length; i++) {
			if (entities[i].entityId == entityId) {
				return entities[i];
			}
		}/*
        return _.findWhere(entities, {
            'entityId': entityId
        });*/
    }

    function removeEntity(entityId) {
        var i = entities.length;
        while (i--) {
            if (entities[i].entityId == entityId) {
                entities.splice(i, 1);
            }
        }
    }

    function addEntity(entityId, classInfo, serialNumber) {
        removeEntity(entityId);
		entity = new Entity();
		entity.entityId = entityId;
        entity.classInfo = classInfo;
        entity.serialNumber = serialNumber;
        entity.generateProperties();
		entities.push(entity);
        return entity;
    }


    function readMessage(dataView) {
        var messageTypeId = dataView.getVarInt32();
        var size = dataView.getVarInt32();
        var messageType = _.findWhere(netMessageTypes, {
            id: messageTypeId
        });
        if (messageType == null || messageType.handler == null) {
            dataView.skip(size);
        } else {
            var tmp = dataView.chunk(size);
            var msg = messageType.msg.decode(tmp.buffer);
            messageType.handler(msg);
            return msg;
        }
    }

    function readStringTables(dataView) {

        var size = dataView.getInt32();
        var chunk = dataView.chunk(size);
        var bitView = new BitView(chunk.buffer);
        var bitStream = new BitStream(bitView);
        var numTables = bitStream.readBits(8, false);

        for (var i = 0; i < numTables; i++) {

            var tableName = bitStream.readASCIIString();

            var isUserInfo = tableName == 'userinfo';
            var numstrings = bitStream.readInt16(true);

            for (var j = 0; j < numstrings; j++) {

                var word = bitStream.readASCIIString();

                if (bitStream.readBits(1)) {

                    var userDataSize = bitStream.readInt16(true);
                    if (isUserInfo && userData != '') {

                        var b = new jDataView(new ArrayBuffer(userDataSize), 0, undefined, true);
                        for (var i = 0; i < userDataSize; i++) {
                            b.writeUint8(bitStream.readBits(8, false), i);
                        }
                        b.seek(0);

                        var player = new classes.Player();
                        player.readFromStream(b);
                        players.push(player);

                    } else {
                        var userData = bitStream.readBits(userDataSize * 8);
                    }
                }
            }
            if (isUserInfo) self.emit('players_info', players);
            bitStream.readBits(1);
        }
    }

    function throwError() {
        clearInterval(processingInterval);
        processingInterval = null;
        self.emit('error');
    }

    this.parse = function(file) {

        var reader = new FileReader();

        reader.onload = function(o) {

            var dataView = new jDataView(reader.result, 0, undefined, true);
            var header = classes.header(dataView);

            processingInterval = setInterval(function() {

                var iterations = 50;

                while (iterations-- && processingInterval != null) {

                    var cmdFields = classes.cmdHeader(dataView);

                    self.emit('data');

                    switch (cmdFields.cmd) {
                        case 1:
                        case 2:
                            dataView.skip(160);
                            var chunkSize = dataView.getInt32();
                            var chunk = dataView.chunk(chunkSize);
                            while (chunk.tell() < chunk.byteLength) {
                                readMessage(chunk);
                            }

                            break;

                        case 3: //dem_synctick
                        case 8: //dem_customdata
                            break;

                        case 4: //dem_consolecmd
                            var size = dataView.getInt32();
                            dataView.skip(size);
                            break;

                        case 9: //dem_stringtables
                            readStringTables(dataView);
                            break;

                        case 6: //dem_datatables
                            var size = dataView.getInt32();
                            var chunk = dataView.chunk(size);

                            while (true) {
                                var msg = readMessage(chunk, true);
                                dataTables.push(msg);
                                if (msg.is_end) break;
                            }

                            var numberOfServerClasses = chunk.getInt16();
                            for (var i = 0; i < numberOfServerClasses; i++) {
                                currentExcludes = [];
                                var srvClass = classes.serverClass(chunk);
                                srvClass.dataTable = _.findWhere(dataTables, {
                                    net_table_name: srvClass.strDTName
                                });
                                gatherExcludes(srvClass.dataTable);
                                gatherProps(srvClass.dataTable, srvClass);
                                sortProps(srvClass.flattenedProps);
                                serverClasses.push(srvClass);
                            }

                            var tmp = numberOfServerClasses;
                            nServerClassBits = 0;
                            while (tmp >>= 1) ++nServerClassBits;
                            nServerClassBits++;
                            break;

                        case 5: //dem_usercmd
                            var outgoing_sequence = dataView.getInt32();
                            var size = dataView.getInt32();
                            dataView.skip(size);
                            break;

                        case 7: //dem_stop
                            clearInterval(processingInterval);
                            processingInterval = null;
                            self.emit('done');
                            break;

                    }
                }

            }, 1);
        };
        reader.readAsArrayBuffer(file);
    }

	this.findEntity = findEntity;
    this.findPlayer = findPlayer;
    this.findPlayerEntity = findPlayerEntity;
    this.getPlayers = function() { return players; };
    this.findPlayerByEntity = function(entity) {
		var index = entities.indexOf(entity);
		if (index == -1) {
			return null;
		}
		return findPlayer(index + 1);
	}
}

Demo.prototype = new EventEmitter();

Demo.prototype.isPlayer = function(entity) {
	var player = this.findPlayerByEntity(entity);
	if (player != null && !player.fakePlayer) {
		return true;
	}
	return false;
}