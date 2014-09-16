"use strict";

var ns;

if (typeof window != 'undefined' || typeof self != 'undefined') {
    var ctx = (typeof window != 'undefined' ? window : self);

    if (typeof ctx.glsl == 'undefined') {
        ctx.glsl = {};
    }

    ctx.glsl.sst = {};
    ns = ctx.glsl.sst;

    global = ctx;
} else {
    // in node
    var glsl = {
        source: require('./source'),
        ast: require('./ast'),
        tokenizer: require('./tokenizer'),
        builtins: require('./builtins'),
    }

    ns = exports;
}

(function(exports) {

var Tn = glsl.tokenizer.Tokenizer;

function Error(loc, message) {
    glsl.source.Error.call(this, loc, message);
}

Error.prototype = Object.create(glsl.source.Error.prototype);
Error.prototype.constructor = Error;

exports.Error = Error;

function Annotate(ast) {
    (new Annotator(ast)).annotate();
}

function Annotator(ast) {
    this._ast = ast;

    this._ast.function_protos = [];
    this._ast.function_proto_map = {};

    this._ast.functions = [];
    this._ast.function_map = {};

    this._scope = null;
    this._scopes = [];

    var bscope = this._push_scope({
        function_protos: [],
        function_proto_map: {}
    });

    bscope.marshal = function() {
        return '(builtin scope)';
    }

    // Push builtin types into the scope
    for (var i = 0; i < glsl.builtins.Types.length; i++) {
        var btype = glsl.builtins.Types[i];
        var t = btype.type.t.type;

        this._declare_type(t);
    }

    // Push builtin functions into the scope
    for (var i = 0; i < glsl.builtins.Functions.length; i++) {
        var f = glsl.builtins.Functions[i];

        this._scope.function_proto_map[f.header.signature()] = f;
        this._scope.function_protos.push(f);
    }

    this._push_scope(ast);
    this._errors = [];
}

Annotator.prototype.annotate = function() {
    this._annotate_node(this._ast);
    this._ast._errors = this._ast._errors.concat(this._errors);
}

Annotator.prototype._is_toplevel_scope = function(scope) {
    return scope == this._ast;
}

Annotator.prototype._push_scope = function(node) {
    if (!glsl.ast.StructDecl.prototype.isPrototypeOf(node)) {
        node.variables = [];
        node.variable_map = {};
    }

    node.types = [];
    node.type_map = {};

    node.symbols = {};

    node.parent_scope = this._scope;

    this._scope = node;
    this._scopes.unshift(this._scope);

    return node;
}

Annotator.prototype._pop_scope = function() {
    var ret = this._scopes.shift();
    this._scope = this._scopes[0];

    return ret;
}

Annotator.prototype._annotate_node = function(node) {
    if (node === null) {
        return;
    }

    var n = node.node_name.replace(/\B[A-Z]+/g, '_$&').toLowerCase();
    var fn = '_annotate_' + n;

    if (typeof this[fn] !== 'function') {
        throw new global.Error('no annotator available for ' + node.node_name);
    }

    node.t = {
        type: null
    };

    return this[fn](node);
}

Annotator.prototype._annotate_parser = function(node) {
    for (var i = 0; i < node.body.length; i++) {
        this._annotate_node(node.body[i]);
    }
}

Annotator.prototype._lookup = function(name, mapname) {
    var scope = this._scope;

    while (scope !== null) {
        if (typeof scope[mapname] !== 'undefined' && name in scope[mapname]) {
            return scope[mapname][name];
        }

        scope = scope.parent_scope;
    }

    return null;
}

Annotator.prototype._lookup_type = function(name) {
    return this._lookup(name, 'type_map');
}

Annotator.prototype._lookup_symbol = function(name) {
    return this._lookup(name, 'symbols');
}

Annotator.prototype._lookup_function = function(name) {
    return this._lookup(name, 'function_map');
}

Annotator.prototype._lookup_function_proto = function(name) {
    return this._lookup(name, 'function_proto_map');
}

Annotator.prototype._lookup_function_or_proto = function(name) {
    var f = this._lookup_function(name);

    if (f !== null) {
        return f;
    }

    return this._lookup_function_proto(name);
}

Annotator.prototype._declare_type = function(type) {
    this._scope.types.push(type);
    this._scope.type_map[type.name] = type;
    this._scope.symbols[type.name] = type;
}

Annotator.prototype._declare_variable = function(node) {
    this._scope.variable_map[node.name.text] = node;
    this._scope.variables.push(node);

    this._scope.symbols[node.name.text] = node;
}

Annotator.prototype._lookup_or_declare_type = function(type) {
    var tp = this._lookup_type(type.name);

    if (tp === null) {
        this._declare_type(type);
        return type;
    }

    return tp;
}

Annotator.prototype._annotate_type_ref = function(type) {
    if (type.incomplete) {
        return;
    }

    if (type.decl !== null) {
        this._annotate_node(type.decl);

        type.t.type = type.decl.t.type;
    } else {
        if (type.is_primitive) {
            type.t.type = glsl.builtins.TypeMap[type.token.id].type.t.type;
        } else {
            type.t.type = this._lookup_type(type.token.text);
        }
    }

    if (type.t.type === null) {
        this._error(type.location(), 'unknown type ' + type.token.text);
    }
}

Annotator.prototype._annotate_array = function(node, element_type) {
    if (node.is_array) {
        if (this._resolve_array_size(node)) {
            node.t.type = this._lookup_or_declare_type(new glsl.builtins.ArrayType(element_type, node.array_size.t.const_value));
        }
    }
}

Annotator.prototype._annotate_named = function(node) {
    this._annotate_node(node.initial_value);

    if (!node.is_array) {
        node.t.type = node.type.t.type;
    } else {
        this._annotate_array(node, node.type.t.type);
    }

    if (node.type.is_const()) {
        if (node.initial_value !== null) {
            if (!node.initial_value.t.is_const_expression) {
                this._error(node.initial_value.location(), 'expected constant initial value expression');
            } else {
                node.t.is_const_expression = true;
                node.t.const_value = node.initial_value.t.const_value;
            }
        } else {
            this._error(node.location(), 'missing constant value initialization');

            node.t.is_const_expression = true;
            node.t.const_value = node.t.type.zero;
        }
    }
}

Annotator.prototype._annotate_param_decl = function(node) {
    this._annotate_node(node.type);

    if (!node.is_array) {
        node.t.type = node.type.t.type;
    } else {
        this._annotate_array(node, node.type.t.type);
    }
}

Annotator.prototype._annotate_variable_decl = function(node) {
    this._annotate_node(node.type);

    for (var i = 0; i < node.names.length; i++) {
        var name = node.names[i];

        this._annotate_node(name);

        // Check if variable with the same name is already declared in this
        // scope
        if (name.name !== null && name.name.text in this._scope.symbols) {
            var sym = this._scope.symbols[name.name.text];

            if (glsl.ast.Named.prototype.isPrototypeOf(sym) && glsl.ast.VariableDecl.prototype.isPrototypeOf(sym.decl)) {
                this._error(name.location(), 'the variable \'' + name.name.text + '\' has already been declared in this scope, previous declaration was at ' + sym.location().inspect());
                continue;
            } else {
                this._error(name.location(), 'a ' + this._error_symbol_type_name(sym) + ' \'' + name.name.text + '\' has already been declared in this scope, previous declaration was at ' + sym.location().inspect());
            }
        }

        // Declare variable
        this._declare_variable(name);
    }
}

Annotator.prototype._annotate_type_decl = function(node) {
    this._annotate_node(node.type);
}

Annotator.prototype._annotate_struct_decl = function(node) {
    var type;

    if (node.name !== null) {
        var tp = this._lookup_symbol(node.name.text);

        if (tp !== null) {
            this._error(node.location(), 'a type named ' + node.name.text + ' has already been declared, previous declaration was at ' + tp.location().inspect());
            return;
        }

        type = new glsl.builtins.UserType(node.name.text, node);
        this._declare_type(type);
    } else {
        // new anonymous user type
        type = new glsl.builtins.UserType(null, node);
    }

    node.t.type = type;
    this._push_scope(node);

    var field_map = {};

    for (var i = 0; i < node.fields.length; i++) {
        var field = node.fields[i];

        this._annotate_node(field.type);

        for (var j = 0; j < field.names.length; j++) {
            var name = field.names[j];

            this._annotate_node(name);

            var f = node.t.type.declare_field(name.name.text, name.type.t.type);
            f.decl = name;

            if (name.name.text in field_map) {
                this._error(name.location(), 'a field named ' + name.name.text + ' already exists, previous declaration was at ' + field_map[name.name.text].location().inspect());
            }

            field_map[name] = field;
        }
    }

    this._pop_scope(node);
}

Annotator.prototype._resolve_array_size = function(node) {
    if (!node.is_array) {
        return false;
    }

    this._annotate_node(node.array_size);

    if (!node.array_size.t.is_const_expression) {
        this._error(node.array_size.location(), 'expected constant expression for array size');
        return false;
    } else if (node.array_size.t.type != glsl.builtins.Int) {
        var n;

        if (node.array_size.t.type == glsl.builtins.Float) {
            n = 'float';
        } else if (node.array_size.t.type == glsl.builtins.Bool) {
            n = 'boolean';
        } else {
            n = 'user type';
        }

        this._error(node.array_size.location(), 'expected constant integer expression for array size, but got ' + n);
        return false;
    } else if (node.array_size.const_value <= 0) {
        this._error(node.array_size.location(), 'array size must be larger or equal to 1, but got ' + node.array_size_.const_value);
    }

    return true;
}

Annotator.prototype._annotate_function_header = function(node) {
    // return type
    this._annotate_node(node.type);

    node.t.type = node.type.t.type;

    for (var i = 0; i < node.parameters.length; i++) {
        this._annotate_node(node.parameters[i]);
    }
}

Annotator.prototype._annotate_function_proto = function(node) {
    if (!this._is_toplevel_scope(this._scope)) {
        this._error(node.location(), 'nested function prototypes are not allowed');
        return;
    }

    var id = node.header.signature();
    var name = node.header.name;

    var prev = this._lookup_function(id);

    if (prev !== null) {
        this._error(name.location, 'the function prototype ' + name.text + ' appears after its definition at ' + prev.name.location);
        return;
    } else if (name.text in this._scope.symbols) {
        var sym = this._scope.symbols[name.text];

        this._error(name.location, 'a ' + this._error_symbol_type_name(sym) + ' ' + name.text + ' has already been declared, previous declaration was at ' + sym.location());
        return;
    }

    this._annotate_node(node.header);

    node.t.type = node.header.t.type;

    this._scope.function_protos.push(node);
    this._scope.function_proto_map[id] = node;
}

Annotator.prototype._qualifiers_to_string = function(qualifiers) {
    var ret = '';

    for (var i = 0; i < qualifiers.length; i++) {
        var q = qualifiers[i];

        if (i != 0) {
            ret += ' ';
        }

        ret += q.token.text;
    }

    return ret;
}

Annotator.prototype._matching_qualifiers = function(a, b) {
    if (a.length != b.length) {
        return false;
    }

    var cpa = a.slice();
    var cpb = b.slice();

    while (cpa.length > 0) {
        var i = b.indexOf(cpa.pop());

        if (i != -1) {
            b.splice(i, 1);
        } else {
            return false;
        }
    }

    if (b.length != 0) {
        return false;
    }

    return true;
}

Annotator.prototype._annotate_function_def = function(node) {
    if (!this._is_toplevel_scope(this._scope)) {
        this._error(node.location(), 'nested function definitions are not allowed');
        return;
    }

    var id = node.header.signature();
    var name = node.header.name;

    var prev = this._lookup_function(id);

    if (prev !== null) {
        this._error(name.location, 'the function ' + name.text + ' is already defined, previous definition was at ' + prev.name.location.inspect());
        return;
    } else if (name.text in this._scope.symbols) {
        var sym = this._scope.symbols[name.text];

        this._error(name.location, 'a ' + this._error_symbol_type_name(sym) + ' ' + name.text + ' has already been declared, previous declaration was at ' + sym.location());
        return;
    }

    this._annotate_node(node.header);
    node.t.type = node.header.t.type;

    var proto = this._lookup_function_proto(id);

    if (proto !== null) {
        if (proto.header.type.type != node.header.type.type) {
            this._error(node.header.type.location(), 'the return type ' + node.header.type.token.text + ' of the function definition of ' + name.text + ' does not correspond to the return type ' + proto.header.type.token.text + ' of its prototype declared at ' + proto.location());
        }

        if (node.header.parameters.length == proto.header.parameters.length) {
            for (var i = 0; i < node.header.parameters.length; i++) {
                var param1 = node.header.parameters[i];
                var param2 = proto.header.parameters[i];

                if (!this._matching_qualifiers(param1.type.qualifiers, param2.type.qualifiers)) {
                    this._error(param1.location(), 'the type qualifiers of parameter ' + param1.name.text + ' (' + this._qualifiers_to_string(param1.type.qualifiers) + ') of the function definition of ' + name.text + ' do not correspond to the parameter type qualifiers ' + this._qualifiers_to_string(param2.type.qualifiers) + ' of its prototype declared at ' + param2.location());
                }
            }
        }
    }

    this._scope.functions.push(node);
    this._scope.function_map[id] = node;

    this._push_scope(node);

    for (var i = 0; i < node.header.parameters.length; i++) {
        var param = node.header.parameters[i];

        if (i == 0 && param.type.token.id == Tn.T_VOID) {
            continue;
        }

        this._scope.variables.push(param);
        this._scope.variable_map[param.name.text] = param;

        this._scope.symbols[param.name.text] = param;
    }

    this._annotate_node(node.body);

    this._pop_scope();
}

Annotator.prototype._annotate_block = function(node) {
    if (node.new_scope) {
        this._push_scope(node);
    }

    for (var i = 0; i < node.body.length; i++) {
        var item = node.body[i];

        this._annotate_node(item);
    }

    if (node.new_scope) {
        this._pop_scope();
    }
}

Annotator.prototype._annotate_precision_stmt = function(node) {
    this._annotate_node(node.type);

    if (node.type.t.type === null) {
        return
    }

    var tp = node.type.t.type;

    var allowed = [
        glsl.builtins.Int,
        glsl.builtins.Float,
        glsl.builtins.Sampler2D,
        glsl.builtins.SamplerCube
    ];

    if (allowed.indexOf(tp) == -1) {
        this._error(node.location(), 'precision can only be set for int, float and sampler types');
    }
}

Annotator.prototype._error_symbol_type_name = function(node) {
    var map = [
        [glsl.ast.FunctionDef, 'function definition'],
        [glsl.ast.FunctionProto, 'function prototype'],
        [glsl.ast.StructDecl, 'struct'],
        [glsl.ast.VariableDecl, 'variable'],
    ];

    for (var i = 0; i < map.length; i++) {
        var item = map[i];

        if (item[0].prototype.isPrototypeOf(node)) {
            return item[1];
        }
    }

    return node.node_name;
}

Annotator.prototype._annotate_invariant_decl = function(node) {
    for (var i = 0; i < node.names.length; i++) {
        var name = node.names[i];

        var symbol = this._lookup_symbol(name.text);

        if (symbol === null) {
            this._error(name.location, 'cannot make unknown variable ' + name.text + ' invariant');
        } else if (!glsl.ast.Named.prototype.isPrototypeOf(symbol) ||
                   !glsl.ast.VariableDecl.prototype.isPrototypeOf(symbol.decl)) {
            var n = this._error_symbol_type_name(symbol);

            this._error(name.location, 'cannot make the ' + n + ' ' + name.text + ' invariant');
        }
    }
}

Annotator.prototype._annotate_expression_stmt = function(node) {
    this._annotate_node(node.expression);
}

Annotator.prototype._init_expr = function(node) {
    node.t.is_const_expression = false;
    node.t.const_value = null;
}

Annotator.prototype._annotate_constant_expr = function(node) {
    this._init_expr(node);

    node.t.is_const_expression = true;
    node.t.const_value = node.token.value;

    switch (node.token.id) {
    case Tn.T_INTCONSTANT:
        node.t.type = glsl.builtins.Int;
        break;
    case Tn.T_FLOATCONSTANT:
        node.t.type = glsl.builtins.Float;
        break;
    case Tn.T_BOOLCONSTANT:
        node.t.type = glsl.builtins.Bool;
        break;
    }
}

Annotator.prototype._annotate_function_call_expr = function(node) {
    this._init_expr(node);

    var argnames = [];

    node.t.decl = null;
    node.t.is_constructor = false;

    var isok = true;

    for (var i = 0; i < node.arguments.length; i++) {
        var arg = node.arguments[i];

        this._annotate_node(arg);

        if (arg.t.type === null) {
            isok = false;
            continue;
        }

        if (i == 0 && arg.t.type == glsl.builtins.Void) {
            continue;
        }

        argnames.push(arg.t.type.name);
    }

    if (!isok) {
        return;
    }

    var tp = this._lookup_type(node.name.text);

    if (tp !== null) {
        node.t.type = tp;
        node.t.is_constructor = true;

        if (tp.is_primitive) {
            if (tp.is_scalar) {
                if (node.arguments.length != 1) {
                    this._error(node.location(), 'constructor of type ' + tp.name + ' requires exactly 1 argument, ' + node.arguments.length + ' given');
                } else {
                    var nt = node.arguments[0].t;

                    if (!nt.type.is_primitive) {
                        this._error(node.location, 'constructor of type ' + tp.name + ' cannot be called with type ' + nt.type.name);
                    } else if (nt.is_const_expression) {
                        node.t.is_const_expression = true;

                        if (nt.type.is_scalar) {
                            node.t.const_value = nt.const_value;
                        } else {
                            node.t.const_value = nt.const_value[0];
                        }
                    }
                }
            } else if (tp.is_vec || tp.is_mat) {
                if (node.arguments.length == 1) {
                    var arg0 = node.arguments[0].t;

                    if (arg0.type.is_scalar && arg0.is_const_expression) {
                        node.t.is_const_expression = true;
                        node.t.const_value = [];

                        for (var i = 0; i < tp.length; i++) {
                            if (tp.is_vec) {
                                node.t.const_value.push(arg0.const_value);
                            } else {
                                var col = [];

                                for (var j = 0; j < tp.length; j++) {
                                    if (j == i) {
                                        col.push(arg0.const_value);
                                    } else {
                                        col.push(0);
                                    }
                                }

                                node.t.const_value.push(col);
                            }
                        }
                    } else if (!arg0.type.is_scalar) {
                        if (arg0.type.is_vec != tp.is_vec || arg0.type.is_mat != tp.is_mat) {
                            this._error(node.location(), 'cannot call constructor of type ' + tp.name + ' with argument of type ' + arg0.type.name);
                        } else if (arg0.is_const_expression) {
                            node.t.is_const_expression = true;
                            node.t.const_value = [];

                            for (var i = 0; i < tp.length; i++) {
                                if (tp.is_vec) {
                                    if (i >= arg0.type.length) {
                                        node.t.const_value.push(0);
                                    } else {
                                        node.t.const_value.push(arg0.const_value[i]);
                                    }
                                } else {
                                    var col = [];

                                    for (var j = 0; j < tp.length; j++) {
                                        if (i >= arg0.type.length || j >= arg0.type.length) {
                                            col.push(i == j ? 1 : 0);
                                        } else {
                                            col.push(arg0.const_value[i][j]);
                                        }
                                    }

                                    node.t.const_value.push(col);
                                }
                            }
                        }
                    }
                } else if (node.arguments.length > 1) {
                    var val = [];
                    var mval = [];

                    node.t.is_const_expression = true;

                    for (var i = 0; i < node.arguments.length; i++) {
                        var arg = node.arguments[i];

                        if (tp.is_mat && arg.t.type.is_mat) {
                            this._error(arg.location(), 'cannot construct matrix with intermixed matrix argument');
                            return;
                        }

                        if (arg.t.is_const_expression) {
                            var v = arg.t.const_value;

                            if (!arg.t.type.is_primitive) {
                                this._error(arg.location(), 'cannot use value of type ' + arg.t.type.name + ' to construct value of type ' + tp.name);
                                return;
                            }

                            if (arg.t.type.is_scalar) {
                                v = [v];
                            }

                            for (var j = 0; j < v.length; j++) {
                                if (val.length == tp.length) {
                                    if (tp.is_mat) {
                                        mval.push(val);
                                        val = [];

                                        if (mval.length == tp.length) {
                                            this._error(arg.location(), 'too many values to construct value of type ' + tp.name);
                                            return;
                                        }
                                    } else {
                                        this._error(arg.location(), 'too many values to construct value of type ' + tp.name);
                                        return;
                                    }
                                }

                                val.push(v[j]);
                            }
                        } else {
                            node.t.is_const_expression = false;
                        }
                    }

                    if (val.length != tp.length) {
                        this._error(node.location(), 'not enough values to fully construct type ' + tp.name);
                        return;
                    }

                    if (tp.is_mat) {
                        mval.push(val);

                        if (mval.length != tp.length) {
                            this._error(node.location(), 'not enough values to fully construct type ' + tp.name);
                            return;
                        }
                    }

                    if (node.t.is_const_expression) {
                        if (tp.is_mat) {
                            node.t.const_value = mval;
                        } else {
                            node.t.const_value = val;
                        }
                    }
                } else {
                    node.t.is_const_expression = true;
                    node.t.const_value = node.t.type.zero;
                }
            }
        } else {
            // structures
            if (node.arguments.length != tp.fields.length) {
                this._error(node.location(), 'expected ' + tp.fields.length + ' arguments, but got ' + node.arguments.length);
                return;
            }

            node.t.is_const_expression = true;
            var val = {};

            for (var i = 0; i < node.arguments.length; i++) {
                var arg = node.arguments[i];
                var field = tp.fields[i];

                if (arg.t.type != field.type) {
                    this._error(arg.location(), 'cannot initialize ' + tp.name + '.' + field.name + ' with type ' + field.type.name + ' from argument of type ' + arg.t.type.name);
                    continue;
                } else if (arg.t.is_const_expression) {
                    val[field.name] = arg.t.const_value;
                    node.t.is_const_expression = true;
                }
            }

            if (node.t.is_const_expression) {
                node.t.const_value = val;
            }
        }

        return;
    }

    var sig = glsl.ast.FunctionHeader.signature_from_names(node.name.text, argnames);
    var f = this._lookup_function_or_proto(sig);

    if (f === null) {
        this._error(node.location(), 'could not find function matching signature ' + sig);
        return;
    }

    if (glsl.ast.FunctionProto.prototype.isPrototypeOf(f) && f.is_builtin && f.evaluate !== null) {
        var cargs = [];

        for (var i = 0; i < node.arguments.length; i++) {
            var arg = node.arguments[i];

            if (arg.t.is_const_expression) {
                cargs.push(arg.t.const_value);
            } else {
                cargs = null;
                break;
            }
        }

        if (cargs != null) {
            node.t.is_const_expression = true;
            node.t.const_value = f.evaluate.apply(this, cargs);
        }
    }

    node.t.type = f.header.type.t.type;
    node.t.decl = f;
}

Annotator.prototype._annotate_variable_expr = function(node) {
    this._init_expr(node);

    var sym = this._lookup_symbol(node.name.text);

    node.t.decl = null;

    if (sym == null) {
        this._error(node.location(), 'undefined variable ' + node.name.text);
    } else if ((glsl.ast.Named.prototype.isPrototypeOf(sym) && glsl.ast.VariableDecl.prototype.isPrototypeOf(sym.decl)) ||
               glsl.ast.ParamDecl.prototype.isPrototypeOf(sym)) {
        node.t.decl = sym;
        node.t.type = sym.t.type;

        if (glsl.ast.Named.prototype.isPrototypeOf(sym) && sym.t.is_const_expression) {
            node.t.is_const_expression = true;
            node.t.const_value = sym.t.const_value;
        }
    } else {
        this._error(node.location(), 'expected a variable for ' + node.name.text + ' but got a ' + this._error_symbol_type_name(sym));
    }
}

Annotator.prototype._annotate_assignment_expr = function(node) {
    this._init_expr(node);

    this._annotate_node(node.lhs);
    this._annotate_node(node.rhs);

    if (node.lhs.t.is_const_expression) {
        node.t.is_const_expression = true;
        node.t.const_value = node.lhs.const_value;
    }

    node.t.type = node.lhs.t.type;

    if (node.lhs.t.type !== null && node.rhs.t.type !== null) {
        if (node.lhs.t.type != node.rhs.t.type) {
            this._error(node.lhs.location().extend(node.op.location), 'cannot assign expression of type ' + node.rhs.t.type.name + ' to a value of type ' + node.lhs.t.type.name);
        }
    }

    // TODO: check for valid l-value expressions
    // TODO: check for array assignment
}

Annotator.prototype._annotate_bin_op_expr = function(node) {
    this._init_expr(node);

    this._annotate_node(node.lhs);
    this._annotate_node(node.rhs);

    // Make some guess if lhs or rhs could not be type checked
    if (node.lhs.t.type === null) {
        node.t.type = node.rhs.t.type;
    } else if (node.rhs.t.type == null) {
        node.t.type = node.lhs.t.type;
    } else if (node.lhs.t.type !== null && node.rhs.t.type !== null) {
        if (node.op.id == Tn.T_EQ_OP || node.op.id == Tn.T_NE_OP) {
            if (node.lhs.t.type == node.rhs.t.type) {
                node.t.type = glsl.builtins.Bool;
                return;
            }
        }

        var sig = node.op.text + '(' + node.lhs.t.type.name + ',' + node.rhs.t.type.name + ')';

        if (sig in glsl.builtins.OperatorMap) {
            var op = glsl.builtins.OperatorMap[sig];
            node.t.type = op.ret;

            if (node.lhs.t.is_const_expression && node.rhs.t.is_const_expression) {
                node.t.is_const_expression = true;
                node.t.const_value = op.evaluate(node.lhs.t.const_value, node.rhs.t.const_value);
            }
        } else {
            this._error(node.location(), 'cannot use the \'' + node.op.text + '\' operator on types ' + node.lhs.t.type.name + ' and ' + node.rhs.t.type.name);
        }
    }
}

Annotator.prototype._annotate_unary_op_expr = function(node) {
    this._init_expr(node);

    this._annotate_node(node.expression);

    if (node.expression.t.type === null) {
        return;
    }

    var sig = node.op.text + '(' + node.expression.t.type.name + ')';

    if (sig in glsl.builtins.OperatorMap) {
        var op = glsl.builtins.OperatorMap[sig];
        node.t.type = op.ret;

        if (node.expression.t.is_const_expression) {
            node.t.is_const_expression = true;

            if (glsl.ast.UnaryPostfixOpExpr.prototype.isPrototypeOf(node)) {
                node.t.const_value = node.expression.t.const_value;
            } else {
                node.t.const_value = op.evaluate(node.expression.t.const_value);
            }
        }
    } else {
        this._error(node.location(), 'cannot use the \'' + node.op.text + '\' operator on type ' + node.expression.t.type.name);
    }
}

Annotator.prototype._annotate_unary_postfix_op_expr = function(node) {
    this._annotate_unary_op_expr(node);
}

Annotator.prototype._annotate_ternary_expr = function(node) {
    this._init_expr(node);

    this._annotate_node(node.condition);
    this._annotate_node(node.true_expression);
    this._annotate_node(node.false_expression);

    if (node.condition.t.type !== null && node.condition.t.type != glsl.builtins.Bool) {
        this._error(node.condition.location(), 'the condition of a ternary conditional expression must be of type bool, not ' + node.condition.t.type.name);
    }

    if (node.true_expression.t.type === null && node.false_expression.t.type === null) {
        return;
    }

    if (node.true_expression.t.type === null) {
        node.t.type = node.false_expression.t.type;
    } else if (node.false_expression.t.type === null) {
        node.t.type = node.true_expression.t.type;
    } else if (node.true_expression.t.type != node.false_expression.t.type) {
        this._error(node.true_expression.location().extend(node.false_expression.location()),
                    'the true expression and false expression must be of the same type, but got ' + node.true_expression.t.type.name + ' and ' + node.false_expression.t.type.name);
        node.t.type = node.true_expression.t.type;
    } else {
        node.t.type = node.true_expression.t.type;
    }

    if (node.condition.t.is_const_expression) {
        if (node.condition.t.const_value) {
            if (node.true_expression.t.is_const_expression) {
                node.t.is_const_expression = true;
                node.t.const_value = node.true_expression.t.const_value;
            }
        } else {
            if (node.false_expression.t.is_const_expression) {
                node.t.is_const_expression = true;
                node.t.const_value = node.false_expression.t.const_value;
            }
        }
    }
}

Annotator.prototype._annotate_index_expr = function(node) {
    this._init_expr(node);

    this._annotate_node(node.expression);
    this._annotate_node(node.index);

    var et = node.expression.t.type;

    if (et !== null) {
        if ((!et.is_array && !et.is_primitive) || et.length <= 1) {
            this._error(node.expression.location(), 'only vectors, matrices and arrays can be indexed, not ' + et.name);
        } else if (node.index.t.type !== null && node.index.t.type.is_const_expression && node.index.t.type.const_value >= et.length) {
            this._error(node.index.location(), 'index out of bounds, trying to index element ' + node.index.t.type.const_value + ' in a value of length ' + et.length);
        } else if (et.is_primitive) {
            if (et.is_mat) {
                var m = {2: glsl.builtins.Vec2, 3: glsl.builtins.Vec3, 4: glsl.builtins.Vec4};
                node.t.type = m[et.length];
            } else if (et.is_float) {
                node.t.type = glsl.builtins.Float;
            } else if (et.is_int) {
                node.t.type = glsl.builtins.Int;
            } else if (et.is_bool) {
                node.t.type = glsl.builtins.Bool;
            }
        } else if (et.is_array) {
            node.t.type = et.element_type;
        }
    }

    if (node.index.t.type !== null) {
        if (node.index.t.type != glsl.builtins.Int) {
            this._error(node.index.location(), 'expected integer index expression, but got expression of type ' + node.index.t.type.name);
        } else if (!node.index.t.is_const_expression) {
            this._error(node.index.location(), 'cannot use dynamic indexing');
        } else if (node.expression.t.is_const_expression) {
            node.t.const_value = node.expression.t.const_value[node.index.t.const_value];
            node.t.is_const_expression = true;
        }
    }
}

Annotator.prototype._annotate_field_selection_expr = function(node) {
    this._init_expr(node);
    this._annotate_node(node.expression);

    var et = node.expression.t.type;

    if (et === null) {
        return;
    }

    var s = node.selector.text;

    if (et.is_primitive) {
        if (et.is_vec) {
            var components = {
                'x': 0, 'y': 0, 'z': 0, 'w': 0,
                'r': 1, 'g': 1, 'b': 1, 'a': 1,
                's': 2, 't': 2, 'p': 2, 'q': 2
            };

            var cgroups = [
                'xyzw',
                'rgba',
                'stpq'
            ];

            if (s.length > 4) {
                this._error(node.selector.location, 'component selection on vectors is limited to a maximum of 4 elements, got ' + s.length);
                return;
            }

            var tps = [];

            if (et.is_float) {
                tps = [Tn.T_FLOAT, Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4];
            } else if (et.is_int) {
                tps = [Tn.T_INT, Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4];
            } else if (et.is_bool) {
                tps = [Tn.T_BOOL, Tn.T_BVEC2, Tn.T_BVEC3, Tn.T_BVEC4];
            }

            node.t.type = glsl.builtins.TypeMap[tps[s.length - 1]].type.t.type;

            if (node.expression.t.is_const_expression) {
                node.t.is_const_expression = true;

                if (node.t.type.is_vec) {
                    node.t.const_value = [];

                    for (var i = 0; i < node.t.type.length; i++) {
                        node.t.const_value.push(0);
                    }
                } else {
                    node.t.const_value = 0;
                }
            }

            var ci = 0;

            for (var i = 0; i < s.length; i++) {
                var c = s[i];

                if (!(c in components)) {
                    this._error(node.selector.location.start.advance_chars(i).to_range(),
                                'invalid component selector \'' + c + '\', expected one of \'xyzw\' \'rgba\' or \'stpq\'');
                    return;
                }

                if (i != 0 && ci != components[c]) {
                    this._error(node.selector.location.start.advance_chars(i).to_range(),
                                'cannot mix components of different groups, expected one of \'' + cgroups[ci] + '\'');
                    return;
                }

                ci = components[c];

                var j = cgroups[ci].indexOf(c);

                if (j >= et.length) {
                    this._error(node.selector.location.start.advance_chars(i).to_range(),
                                'selector out of bounds, expression has only ' + et.length + ' components, but tried to select component ' + (ci + 1));
                    return;
                }

                if (node.expression.t.is_const_expression) {
                    if (node.t.type.is_vec) {
                        node.const_value[i] = node.expression.t.const_value[j];
                    } else {
                        node.const_value = node.expression.t.const_value[j];
                    }
                }
            }
        } else {
            this._error(node.expression.location().extend(node.op.location), 'selector \'' + s + '\' does not apply to an expression of type ' + et.name);
        }
    } else if (et.is_composite) {
        // Select on field in user defined type
        if (s in et.field_map) {
            var f = et.field_map[s];

            if (node.expression.t.is_const_expression && s in node.expression.t.const_value) {
                node.t.is_const_expression = true;
                node.t.const_value = node.expression.t.const_value[s];
            }

            node.t.type = f.type;
        } else {
            this._error(node.selector.location, 'the field \'' + s + '\' does not exist in the struct type ' + et.name);
        }
    } else {
        this._error(node.selector.location, 'cannot apply selector \'' + s + '\' to expression of type ' + et.name);
    }
}

Annotator.prototype._copy_type = function(dest, src) {
    dest.t.type = src.t.type;
    dest.t.is_const_expression = src.t.is_const_expression;
    dest.t.const_value = src.t.const_value
}
Annotator.prototype._annotate_group_expr = function(node) {
    this._init_expr(node);
    this._annotate_node(node.expression);

    this._copy_type(node, node.expression);
}

Annotator.prototype._annotate_expression_list_stmt = function(node) {
    for (var i = 0; i < node.expressions.length; i++) {
        this._annotate_node(node.expressions[i]);
    }

    this._copy_type(node, node.expressions[node.expressions.length - 1]);
}

Annotator.prototype._error = function(loc, message) {
    this._errors.push(new Error(loc, message));
}

exports.Annotate = Annotate;

})(ns);

// vi:ts=4:et
