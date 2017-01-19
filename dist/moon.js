/*
* Moon 0.1.3
* Copyright 2016-2017, Kabir Shah
* https://github.com/KingPixil/moon/
* Free to use under the MIT license.
* https://kingpixil.github.io/license
*/

(function(root, factory) {
  /* ======= Global Moon ======= */
  (typeof module === "object" && module.exports) ? module.exports = factory() : root.Moon = factory();
}(this, function() {

    /* ======= Global Variables ======= */
    var config = {
      silent: false,
      prefix: "m-"
    }
    var directives = {};
    var components = {};
    var id = 0;

    /* ======= Global Utilities ======= */
    
    /**
    * Compiles a template with given data
    * @param {String} template
    * @param {Object} data
    * @return {String} Template with data rendered
    */
    var compileTemplate = function(template) {
      var code = template;
      var templateRe = /{{([A-Za-z0-9_.()\[\]]+)}}/gi;
      code.replace(templateRe, function(match, key) {
        code = code.replace(match, "' + data['" + key + "'] + '");
      });
      code = code.replace(/\n/g, "' + \n'");
      var compile = new Function("data", "var out = '" + code + "'; return out");
      return compile;
    }
    
    /**
    * Converts attributes into key-value pairs
    * @param {Node} node
    * @return {Object} Key-Value pairs of Attributes
    */
    var extractAttrs = function(node) {
      var attrs = {};
      if(!node.attributes) return attrs;
      var rawAttrs = node.attributes;
      for(var i = 0; i < rawAttrs.length; i++) {
        attrs[rawAttrs[i].name] = compileTemplate(rawAttrs[i].value);
      }
    
      return attrs;
    }
    
    /**
    * Creates a Virtual DOM Node
    * @param {String} type
    * @param {Array} children
    * @param {Object} props
    * @return {Object} Node For Virtual DOM
    */
    var createElement = function(type, val, props, children, meta, node) {
      return {type: type, val: val, props: props, children: children, meta: meta, node: node};
    }
    
    /**
    * Creates Virtual DOM
    * @param {Node} node
    * @return {Object} Virtual DOM
    */
    var createVirtualDOM = function(node) {
      var tag = node.nodeName;
      var content = tag === "#text" ? compileTemplate(node.textContent) : node.textContent;
      var attrs = extractAttrs(node);
      var defaultMeta = {
        once: false,
        shouldRender: true
      }
      var children = [];
    
      for(var i = 0; i < node.childNodes.length; i++) {
        children.push(createVirtualDOM(node.childNodes[i]));
      }
    
      return createElement(tag, content, attrs, children, defaultMeta, node);
    }
    
    /**
    * Gets Root Element
    * @param {String} html
    * @return {Node} Root Element
    */
    var getRootElement = function(html) {
      var dummy = document.createElement('div');
      dummy.innerHTML = html;
      return dummy.firstChild;
    }
    
    /**
    * Merges two Objects
    * @param {Object} obj
    * @param {Object} obj2
    * @return {Object} Merged Objects
    */
    function merge(obj, obj2) {
      for (var key in obj2) {
        if (obj2.hasOwnProperty(key)) obj[key] = obj2[key];
      }
      return obj;
    }
    
    /**
     * Compiles JSX to Virtual DOM
     * @param {String} tag
     * @param {Object} attrs
     * @param {Array} children
     * @return {String} Object usable in Virtual DOM
     */
    var h = function() {
      var args = Array.prototype.slice.call(arguments);
      var tag = args.shift();
      var attrs = args.shift() || {};
      var children = args;
      return createElement(tag, children.join(""), attrs, children);
    };
    
    /**
     * Sets the Elements Initial Value
     * @param {Node} el
     * @param {String} value
     */
    var setInitialElementValue = function(el, value) {
      el.innerHTML = value;
    }
    
    /**
     * Does No Operation
     */
    var noop = function() {
    
    }
    

    function Moon(opts) {
        /* ======= Initial Values ======= */
        this.$opts = opts || {};

        var self = this;
        var _data = this.$opts.data;

        this.$id = id++;

        this.$render = this.$opts.render || noop;
        this.$hooks = merge({created: noop, mounted: noop, updated: noop, destroyed: noop}, this.$opts.hooks);
        this.$methods = this.$opts.methods || {};
        this.$components = merge(this.$opts.components || {}, components);
        this.$directives = merge(this.$opts.directives || {}, directives);
        this.$events = {};
        this.$dom = {};
        this.$destroyed = false;

        /* ======= Listen for Changes ======= */
        Object.defineProperty(this, '$data', {
            get: function() {
                return _data;
            },
            set: function(value) {
                _data = value;
                this.build(this.$dom.children);
            },
            configurable: true
        });

        /* ======= Default Directives ======= */
        directives[config.prefix + "if"] = function(el, val, vdom) {
          var evaluated = new Function("return " + val);
          if(!evaluated()) {
            for(var i = 0; i < vdom.children.length; i++) {
              vdom.children[i].node.textContent = "";
              vdom.children[i].meta.shouldRender = false;
            }
          } else {
            for(var i = 0; i < vdom.children.length; i++) {
              vdom.children[i].meta.shouldRender = true;
            }
          }
        }
        
        directives[config.prefix + "show"] = function(el, val, vdom) {
          var evaluated = new Function("return " + val);
          if(!evaluated()) {
            el.style.display = 'none';
          } else {
            el.style.display = 'block';
          }
        }
        
        directives[config.prefix + "on"] = function(el, val, vdom) {
          var splitVal = val.split(":");
          var eventToCall = splitVal[0];
          var methodToCall = splitVal[1];
          if(self.$events[eventToCall]) {
            self.on(eventToCall, methodToCall);
          } else {
            el.addEventListener(eventToCall, function(e) {
              self.callMethod(methodToCall, [e]);
            });
          }
          delete vdom.props[config.prefix + "on"];
        }
        
        directives[config.prefix + "model"] = function(el, val, vdom) {
          el.value = self.get(val);
          el.addEventListener("input", function() {
            self.set(val, el.value);
          });
          delete vdom.props[config.prefix + "model"];
        }
        
        directives[config.prefix + "for"] = function(el, val, vdom) {
          var parts = val.split(" in ");
          var alias = parts[0];
          var array = self.get(parts[1]);
        }
        
        directives[config.prefix + "once"] = function(el, val, vdom) {
          vdom.meta.shouldRender = false;
        }
        
        directives[config.prefix + "text"] = function(el, val, vdom) {
          el.textContent = val;
        }
        
        directives[config.prefix + "html"] = function(el, val, vdom) {
          el.innerHTML = val;
        }
        
        directives[config.prefix + "mask"] = function(el, val, vdom) {
        
        }
        

        /* ======= Initialize 🎉 ======= */
        this.init();
    }

    /* ======= Instance Methods ======= */
    
    var hasConsole = typeof window.console !== undefined;
    
    /**
    * Logs a Message
    * @param {String} msg
    */
    Moon.prototype.log = function(msg) {
      if(!config.silent && hasConsole) console.log(msg);
    }
    
    /**
    * Throws an Error
    * @param {String} msg
    */
    Moon.prototype.error = function(msg) {
      if(hasConsole) console.error("[Moon] ERR: " + msg);
    }
    
    /**
    * Gets Value in Data
    * @param {String} key
    * @return {String} Value of key in data
    */
    Moon.prototype.get = function(key) {
      return this.$data[key];
    }
    
    /**
    * Sets Value in Data
    * @param {String} key
    * @param {String} val
    */
    Moon.prototype.set = function(key, val) {
      this.$data[key] = val;
      if(!this.$destroyed) this.build(this.$dom.children);
      this.$hooks.updated();
    }
    
    /**
    * Calls a method
    * @param {String} method
    */
    Moon.prototype.callMethod = function(method, args) {
      args = args || [];
      this.$methods[method].apply(this, args);
    }
    
    // Event Emitter, adapted from https://github.com/KingPixil/voke
    
    /**
    * Attaches an Event Listener
    * @param {String} eventName
    * @param {Function} action
    */
    Moon.prototype.on = function(eventName, action) {
      if(this.$events[eventName]) {
        this.$events[eventName].push(action);
      } else {
        this.$events[eventName] = [action];
      }
    }
    
    /**
    * Removes an Event Listener
    * @param {String} eventName
    * @param {Function} action
    */
    Moon.prototype.off = function(eventName, action) {
      var index = this.$events[eventName].indexOf(action);
      if(index !== -1) {
        this.$events[eventName].splice(index, 1);
      }
    }
    
    /**
    * Removes All Event Listeners
    * @param {String} eventName
    * @param {Function} action
    */
    Moon.prototype.removeEvents = function() {
      for(var evt in this.$events) {
        this.$events[evt] = [];
      }
    }
    
    /**
    * Emits an Event
    * @param {String} eventName
    * @param {Object} meta
    */
    Moon.prototype.emit = function(eventName, meta) {
      meta = meta || {};
      meta.type = eventName;
    
      if(this.$events["*"]) {
        for(var i = 0; i < this.$events["*"].length; i++) {
          var globalHandler = this.$events["*"][i];
          globalHandler(meta);
        }
      }
    
      for(var i = 0; i < this.$events[eventName].length; i++) {
        var handler = this.$events[eventName][i];
        handler(meta);
      }
    }
    
    /**
    * Mounts Moon Element
    */
    Moon.prototype.mount = function(el) {
      this.$el = document.querySelector(el);
    
      if(!this.$el) {
        this.error("Element " + this.$opts.el + " not found");
      }
    
      this.$template = this.$opts.template || this.$el.innerHTML;
    
      setInitialElementValue(this.$el, this.$template);
    
      this.$dom = createVirtualDOM(this.$el);
    
      this.build(this.$dom.children);
      this.$hooks.mounted();
    }
    
    /**
    * Destroys Moon Instance
    */
    Moon.prototype.destroy = function() {
      Object.defineProperty(this, '$data', {
        set: function(value) {
          _data = value;
        }
      });
      this.removeEvents();
      this.$destroyed = true;
      this.$hooks.destroyed();
    }
    
    /**
    * Builds the DOM With Data
    * @param {Array} children
    */
    Moon.prototype.build = function(vdom) {
      for(var i = 0; i < vdom.length; i++) {
        var vnode = vdom[i];
        if(vnode.meta.shouldRender) {
          if(vnode.type === "#text") {
            var valueOfVNode = "";
            valueOfVNode = vnode.val(this.$data);
            vnode.node.textContent = valueOfVNode;
          } else if(vnode.props) {
            for(var attr in vnode.props) {
              var compiledProp = vnode.props[attr](this.$data);
              if(directives[attr]) {
                vnode.node.removeAttribute(attr);
                directives[attr](vnode.node, compiledProp, vnode);
              } else {
                vnode.node.setAttribute(attr, compiledProp);
              }
            }
          }
    
          this.build(vnode.children);
        }
      }
    }
    
    /**
    * Initializes Moon
    */
    Moon.prototype.init = function() {
      this.log("======= Moon =======");
      this.$hooks.created();
    
      if(this.$opts.el) {
        this.mount(this.$opts.el);
      }
    }
    

    /* ======= Global API ======= */
    
    /**
    * Sets the Configuration of Moon
    * @param {Object} opts
    */
    Moon.config = function(opts) {
      if(opts.silent) {
        config.silent = opts.silent;
      }
      if(opts.prefix) {
        config.prefix = opts.prefix + "-";
      }
    }
    
    /**
    * Runs an external Plugin
    * @param {Object} plugin
    */
    Moon.use = function(plugin) {
      plugin.init(Moon);
    }
    
    /**
    * Creates a Directive
    * @param {String} name
    * @param {Function} action
    */
    Moon.directive = function(name, action) {
      directives[config.prefix + name] = action;
    }
    
    /**
    * Creates a Component
    * @param {String} name
    * @param {Function} action
    */
    Moon.component = function(name, opts) {
      var Parent = this;
      function MoonComponent() {
        Moon.call(this, opts);
      }
      MoonComponent.prototype = Object.create(Parent.prototype);
      MoonComponent.prototype.constructor = MoonComponent;
      var component = new MoonComponent();
      components[name] = component;
      return component;
    }
    

    return Moon;
}));
