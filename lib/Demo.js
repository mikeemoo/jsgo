(function() {

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

  var Entity = require('./Entity.js');
  var entityClassMap = {
    'DT_CSPlayer': Entity.Player,
    'DT_CSTeam': Entity.Team,
    'DT_DecoyGrenade': Entity.DecoyGrenade,
    'DT_HEGrenade': Entity.HEGrenade,
    'DT_Flashbang': Entity.Flashbang,
    'DT_SmokeGrenade': Entity.SmokeGrenade
  }

  function inherits(childConstructor, parentConstructor) {
    function tempConstructor() {};
    tempConstructor.prototype = parentConstructor.prototype;
    childConstructor.prototype = new tempConstructor();
    childConstructor.prototype.constructor = childConstructor;
  }

  var EventEmitter = require('events').EventEmitter;

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
    demo = this;
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
        //this.players = [];
      }

      for (var j = 0; j < numStrings; j++) {

        var string = stream.string(4096, true);

        if (stream.bits(1)) {

          var userDataSize = stream.int16();
          var postReadDest = stream.tellBits() + (userDataSize * 8);

          if (isUserTable) {
            var player = this.readPlayer(stream);
            //console.log('adding a player from string table');
            //this.addPlayer(player);
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
        klazz = Entity.Entity;
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
        //delete params.userid;
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
    if (typeof index !== 'undefined') {
      this.players[index] = player;
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
      if (this.players[i] != null && this.players[i].userId == userId) {
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

  Demo.prototype.getTPlayers = function() {
    return this.getPlayers.filter(function(player) {
      return player.getTeam().getSide == Team.sides.T;
    });
  };

  Demo.prototype.getCTPlayers = function() {
    return this.getPlayers.filter(function(player) {
      return player.getTeam().getSide == Team.sides.CT;
    });
  };

  module.exports.Demo = Demo;
})();
