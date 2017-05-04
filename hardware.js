'use strict';

////////////////////////////////////////////////
//  custom elements
////////////////////////////////////////////////

// create the elements used for hardware input

obtain(['µ/Arduino', 'µ/utilities.js'], (ard, utils)=> {
  var Arduino = ard.Arduino;
  var inPut = inheritFrom(HTMLElement, function() {

    //default
    this.onData = function(val) {
      console.log('Handler function not yet initialized');
    };

    this.createdCallback = function() {
      var _this = this;
      _this.readTO = null;

      this.onError = () => {
        console.log('Did not hear back about read on ' + _this.pin);
      };

      this.read = function() {
        var p = _this.parentElement.arduino;
        if (p.ready) {
          _this.readTO = setTimeout(_this.onError, 1000);
          if (_this.type == 'analog') p.analogRead(_this.pin);
          else p.digitalRead(_this.pin);
        }
      };

      //grab the type and pin attributes
      this.type = this.getAttribute('type');
      this.pin = this.getAttribute('pin');
      if (this.type == 'analog') {
        this.raw = 0;
        this.min = this.getAttribute('low');
        this.max = this.getAttribute('hi');
        this.report = parseInt(this.getAttribute('report'));
        var result = this.getAttribute('result');
        if (result && result.length > 1) {
          result = result.split('.');
          this.target = document.querySelector(result[0]);
          this.which = result[1];
        }
      } else if (this.type == 'digital') {
        var result = this.getAttribute('result');
        if (result) {
          result = result.split('.');
          this.target = document.querySelector(result[0]);
          this.which = result[1];
        }

        this.debounce = 0;
        this.hit = false;
        var temp = this.getAttribute('debounce');
        if (temp) this.debounce = parseInt(temp);
      }
    };
  });

  document.registerElement('in-put', inPut);

  // create the elements used for hardware output

  var outPut = inheritFrom(HTMLElement, function() {

    this.onError = ()=> {
      if (this.pin) console.log("haven't heard about " + this.pin);
    };

    this.onData = ()=> {
      if (this.pin) console.log('Heard about the write on ' + this.pin);
    };

    this.write = function(val) {
      this.state = val;
      this.outputTO = setTimeout(this.onError, 500);
      if (this.mode) this.parentElement.arduino.analogWrite(this.pin, val);
      else this.parentElement.arduino.digitalWrite(this.pin, val);
    };

    this.createdCallback = function() {
      this.outputTO = null;
      this.type = this.getAttribute('type');
      this.pin = this.getAttribute('pin');
      this.mode = (this.type == 'analog');
    };
  });

  document.registerElement('out-put', outPut);

  /////////////////////////////////////////////////////////////
  // create the hard-ware tag. inherit the functions from the arduino,
  // in order to send the control information to the arduino.
  /////////////////////////////////////////////////////////////

  var hardWare = inheritFrom(HTMLElement, function() {
    console.log('defining hard-ware');

    this.createdCallback = function() {
      var _this = this;

      _this.onReady = () => {};

      _this.port = this.getAttribute('serialport');
      _this.arduino = new Arduino();
    };

    this.attachedCallback = function() {
      var _this = this;

      _this.onConnect = function() {};

      _this.init = function() {
        console.log('initializing hardware...');
        this.ready = true;
        this.onReady();
        var inputs = [].slice.call(this.querySelectorAll('in-put'));
        inputs.forEach(function(item, i, arr) {
          if (item.type === 'analog') {
            //create the handler function to parse the data
            function handle(pin, val) {
              item.raw = val;
              if (item.min && item.max) val = utils.map(val, item.min, item.max, 0, 1);
              if (!item.target) item.onData(val);
              else item.target[item.which](val);
            }

            //if the pin is set to report, init the report, otherwise, set the handler
            if (item.report) _this.arduino.analogReport(item.pin, item.report, handle);
            else _this.arduino.setHandler(item.pin, handle);

          } else if (item.type === 'digital') {
            _this.arduino.watchPin(item.pin, function(pin, val) {
              if (!item.hit) {
                clearTimeout(item.readTO);
                if (!item.target) item.onData(val);
                else item.target[item.which](val);

                if (item.debounce) {
                  item.hit = true;
                  item.dbTimer = setTimeout(function() {item.hit = false; }, item.debounce);
                }

              }
            });
          }
        });

        var outputs = [].slice.call(this.querySelectorAll('out-put'));
        outputs.forEach(function(item, i, arr) {
          _this.arduino.setHandler(item.pin, (pin, val)=> {
            clearTimeout(item.outputTO);
            item.onData(val);
          });
        });
      };

      _this.begin = function(noPortCB) {
        console.log('The port is ' + _this.port);
        _this.arduino.serial.onPortNotFound = noPortCB;
        _this.arduino.connect(_this.port, ()=> {
          _this.init();
        });
      };
    };
  });

  exports.Hardware = document.registerElement('hard-ware', hardWare);

  provide(exports);
});
