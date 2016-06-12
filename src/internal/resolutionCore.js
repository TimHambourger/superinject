module.exports = ResolutionCore;

var ROOT_SCOPE_LEVEL = require('./rootScopeLevel');

var ResolutionRequest = require('../resolutionRequest');

var InjectionError = require('../injectionError'),
    ErrorType = require('./errorType');

var ConstructorBinding = require('./bindings/constructorBinding'),
    FunctionBinding = require('./bindings/functionBinding'),
    ConstantBinding = require('./binding/constantBinding'),
    ProviderBinding = require('./binding/providerBinding');

// TODO: Make this configurable...
var MAX_ACTIVATION_DEPTH = 500;

function ResolutionCore(opts) {
    this.currentRequest = null;
    this.bindings = {}; // Dictionary<string, Binding[]>
}

// params -- {ResolutionParameters} Params that describe the request
// scope -- {Scope} The Scope that issued the request
ResolutionCore.prototype.resolveParamsWithScope = function (params, scope) {
    var parentRequest = this.currentRequest;
    var req = this.currentRequest = new ResolutionRequest(params, parentRequest);
    if (req.depth > MAX_ACTIVATION_DEPTH) throw new InjectionError(ErrorType.MaxActivationDepthExceeded, { request: req });
    var bindings = this.findAllBindingsForRequest(req);
    if (!params.multiple) {
        // For requests that aren't flagged as multiple, we enforce the constraint
        // that there must be a single matching binding
        if (bindings.length === 0) throw new InjectionError(ErrorType.NoMatchingBinding, { request: req });
        if (bindings.length > 1) throw new InjectionError(ErrorType.AmbiguousMatchingBindings, { request: req });
    }
    var resolutions = bindings.map(function (binding) {
        if (binding.scopeLevel !== null) {
            var scopeForBinding = binding.scopeLevel === ROOT_SCOPE_LEVEL
                ? scope._rootScope
                : scope._scopesByLevel[binding.scopeLevel];
            return scopeForBinding._cache[params.dependencyId] =
                scopeForBinding._cache[params.dependencyId] || binding.activate(scope, req);
        }
        return binding.activate(scope, req);
    });
    this.currentRequest = parentRequest;
    return params.multiple ? resolutions : resolutions[0];
};

// req -- {ResolutionRequest}
ResolutionCore.prototype.findAllBindingsForRequest = function (req) {
    return this.getSlot(dependencyId).filter(function (binding) {
        return binding.supportsRequest(req);
    });
};

ResolutionCore.prototype.addConstructorBinding = function (dependencyId, constructor) {
    var binding = new ConstructorBinding(dependencyId, constructor);
    this.getOrCreateSlot(dependencyId).push(binding);
    return binding;
};

ResolutionCore.prototype.addFunctionBinding = function (dependencyId, factoryFunc) {
    var binding = new FunctionBinding(dependencyId, factoryFunc);
    this.getOrCreateSlot(dependencyId).push(binding);
    return binding;
};

ResolutionCore.prototype.addConstantBinding = function (dependencyId, val) {
    var binding = new ConstantBinding(dependencyId, val);
    this.getOrCreateSlot(dependencyId).push(binding);
    return binding;
};

ResolutionCore.prototype.addProviderBinding = function (dependencyId, providerFunc) {
    var binding = new ProviderBinding(dependencyId, providerFunc);
    this.getOrCreateSlot(dependencyId).push(binding);
    return binding;
}; 

ResolutionCore.prototype.getOrCreateSlot = function (dependencyId) {
    return this.bindings[this.dependencyId] = this.getSlot(dependencyId);
};

ResolutionCore.prototype.getSlot = function (dependencyId) {
    return Object.prototype.hasOwnProperty.call(this.bindings, dependencyId)
        ? this.bindings[dependencyId]
        : [];
};
