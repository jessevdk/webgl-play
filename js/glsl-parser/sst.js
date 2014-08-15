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

var Error = function(loc, message) {
    glsl.source.Error.call(this, loc, message);
}

Error.prototype = Object.create(glsl.source.Error.prototype);
Error.prototype.constructor = Error;

exports.Error = Error;

function UserType(name, decl) {
    glsl.ast.Node.call(this);

    this.decl = decl;
    this.is_builtin = false;
    this.name = name;
}

UserType.prototype = glsl.ast.Node.create('UserType', UserType);

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

        this._scope.type_map[btype.type.token.text] = btype;
        this._scope.symbols[btype.type.token.text] = btype;
        this._scope.types.push(btype);
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
    var n = node.node_name.replace(/\B[A-Z]+/g, '_$&').toLowerCase();
    var fn = '_annotate_' + n;

    if (typeof this[fn] !== 'function') {
        throw new global.Error('no annotator available for ' + node.node_name);
    }

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

Annotator.prototype._lookup_typename = function(name) {
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

Annotator.prototype._resolve_type = function(type) {
    type.type = null;

    if (type.incomplete) {
        return;
    }

    if (type.is_builtin) {
        type.type = glsl.builtins.TypeMap[type.token.id].type.type;
        return;
    }

    if (glsl.ast.StructDecl.prototype.isPrototypeOf(type)) {
        type.type = new UserType(type.name !== null ? type.name.text : null, type);

        if (!type.incomplete) {
            type.type.complete();
        }

        this._annotate_struct_decl(type);
    } else {
        type.type = this._lookup_typename(type.token.text);
    }

    if (type.type === null) {
        this._error(type.location(), 'unknown type ' + type.token.text);
    }
}

Annotator.prototype._annotate_variable_decl = function(node) {
    this._resolve_type(node.type);

    for (var i = 0; i < node.names.length; i++) {
        var name = node.names[i];

        // Check if variable with the same name is already declared in this
        // scope
        if (name.name !== null && name.name.text in this._scope.symbols) {
            var sym = this._scope.symbols[name.name.text];

            if (glsl.ast.VariableDecl.prototype.isPrototypeOf(sym)) {
                var loc;

                for (var j = 0; j < sym.names.length; j++) {
                    var item = sym.names[j];

                    if (item.name.text == name.name.text) {
                        loc = item.location();
                        break;
                    }
                }

                this._error(name.location(), 'the variable \'' + name.name.text + '\' has already been declared in this scope, previous declaration was at ' + loc.inspect());

                continue;
            } else {
                this._error(name.location(), 'a ' + this._error_symbol_type_name(sym) + ' \'' + name.name.text + '\' has already been declared in this scope, previous declaration was at ' + sym.location());
            }
        }

        this._resolve_array_size(name);

        // Declare variable
        this._scope.variable_map[name.name.text] = node;
        this._scope.variables.push(node);

        this._scope.symbols[name.name.text] = node;
    }
}

Annotator.prototype._annotate_type_decl = function(node) {
    this._annotate_node(node.type);
}

Annotator.prototype._annotate_struct_decl = function(node) {
    if (node.name !== null) {
        var tp = this._lookup_symbol(node.name.text);

        if (tp !== null) {
            this._error(node.location(), 'a type named ' + node.name.text + ' has already been declared, previous declaration was at ' + tp.location().inspect());
            return;
        }

        var type = new UserType(node);

        if (!node.incomplete) {
            type.complete();
        }

        this._scope.types.push(type);
        this._scope.type_map[node.name.text] = type;
        this._scope.symbols[node.name.text] = type;
    }

    this._push_scope(node);

    var fieldmap = {};

    for (var i = 0; i < node.fields.length; i++) {
        var field = node.fields[i];

        for (var j = 0; j < field.names.length; j++) {
            var name = field.names[j];

            if (name.name.text in fieldmap) {
                this._error(name.location(), 'a field named ' + name.name.text + ' already exists, previous declaration was at ' + fieldmap[name.name.text].location().inspect());
                continue;
            }

            this._resolve_array_size(name);
            fieldmap[name] = field;
        }

        this._resolve_type(field.type);
    }

    this._pop_scope(node);
}

Annotator.prototype._resolve_array_size = function(node) {
    if (!node.is_array) {
        return;
    }

    this._annotate_node(node.array_size);

    if (!node.array_size.is_const_expression) {
        this._error(node.array_size.location(), 'expected constant expression for array size');
    } else if (node.array_size.type != glsl.builtins.Int.type.type) {
        var n;

        if (node.array_size.type == glsl.builtins.Float.type.type) {
            n = 'float';
        } else if (node.array_size.type == glsl.builtins.Bool.type.type) {
            n = 'boolean';
        } else {
            n = 'user type';
        }

        this._error(node.array_size.location(), 'expected constant integer expression for array size, but got ' + n);
    }
}

Annotator.prototype._annotate_function_header = function(node) {
    // return type
    this._resolve_type(node.type);

    for (var i = 0; i < node.parameters.length; i++) {
        var param = node.parameters[i];

        this._resolve_type(param.type);
        this._resolve_array_size(param);
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

        if (param.type.token.id == Tn.T_VOID) {
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
    this._resolve_type(node.type);

    if (node.type.type === null) {
        return
    }

    var tp = node.type.type;

    var allowed = [
        glsl.builtins.Int.type.type,
        glsl.builtins.Float.type.type,
        glsl.builtins.Sampler2D.type.type,
        glsl.builtins.SamplerCube.type.type
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

        name.symbol = this._lookup_symbol(name.name.text);

        if (name.symbol === null) {
            this._error(name.name.location, 'cannot make unknown variable ' + name.name.text + ' invariant');
        } else if (!glsl.ast.VariableDecl.prototype.isPrototypeOf(name.symbol)) {
            var n = this._error_symbol_type_name(name.symbol);

            this._error(name.name.location, 'cannot make the ' + n + ' ' + name.name.text + ' invariant');
        }
    }
}

Annotator.prototype._annotate_expression_stmt = function(node) {
    this._annotate_node(node.expression);
}

Annotator.prototype._annotate_constant_expr = function(node) {
    node.is_const_expression = true;
    node.const_value = node.token.value;

    node.type = null;

    switch (node.token.id) {
    case Tn.T_INTCONSTANT:
        node.type = glsl.builtins.Int.type.type;
        break;
    case Tn.T_FLOATCONSTANT:
        node.type = glsl.builtins.Float.type.type;
        break;
    case Tn.T_BOOLCONSTANT:
        node.type = glsl.builtins.Bool.type.type;
        break;
    }
}

Annotator.prototype._annotate_function_call_expr = function(node) {
    var argnames = [];

    node.type = null;
    node.decl = null;
    node.is_constructor = false;

    var isok = true;

    for (var i = 0; i < node.arguments.length; i++) {
        var arg = node.arguments[i];

        this._annotate_node(arg);

        if (arg.type === null) {
            isok = false;
            continue;
        }

        if (i == 0 && arg.type == glsl.builtins.Void.type.type) {
            continue
        }

        argnames.push(arg.type.name);
    }

    if (!isok) {
        return;
    }

    var tp = this._lookup_typename(node.name.text);

    if (tp !== null) {
        // Constructor, resulting type is tp
        // TODO: basic checks for arguments
        node.type = tp.type.type;
        node.is_constructor = true;
        return;
    }

    var sig = glsl.ast.FunctionHeader.signature_from_names(node.name.text, argnames);
    var f = this._lookup_function_or_proto(sig);

    if (f === null) {
        this._error(node.location(), 'could not find function matching signature ' + sig);
        return;
    }

    node.type = f.header.type.type;
    node.decl = f;
}

Annotator.prototype._annotate_variable_expr = function(node) {
    var sym = this._lookup_symbol(node.name.text);
    node.type = null;
    node.decl = null;

    if (sym == null) {
        this._error(node.location(), 'undefined variable ' + node.name.text);
    } else if (!glsl.ast.VariableDecl.prototype.isPrototypeOf(sym) &&
               !glsl.ast.ParamDecl.prototype.isPrototypeOf(sym)) {
        this._error(node.location(), 'expected a variable for ' + node.name.text + ' but got a ' + this._error_symbol_type_name(sym));
    } else {
        node.decl = sym;
        node.type = sym.type.type;
    }
}

Annotator.prototype._annotate_assignment_expr = function(node) {
    this._annotate_node(node.lhs);
    this._annotate_node(node.rhs);

    node.type = node.lhs.type;

    if (node.lhs.type !== null && node.rhs.type !== null) {
        if (node.lhs.type != node.rhs.type) {
            this._error(node.lhs.location().extend(node.op.location), 'cannot assign expression of type ' + node.rhs.type.name + ' to a value of type ' + node.lhs.type.name);
        }
    }

    // TODO: check for valid l-value expressions
}

Annotator.prototype._annotate_bin_op_expr = function(node) {
    this._annotate_node(node.lhs);
    this._annotate_node(node.rhs);

    node.type = null;

    // Make some guess if lhs or rhs could not be type checked
    if (node.lhs.type === null) {
        node.type = node.rhs.type;
    } else if (node.rhs.type == null) {
        node.type = node.lhs.type;
    } else if (node.lhs.type !== null && node.rhs.type !== null) {
        if (node.op.id == Tn.T_EQ_OP || node.op.id == Tn.T_NE_OP) {
            if (node.lhs.type == node.rhs.type) {
                node.type = node.lhs.type;
                return;
            }
        }

        var sig = node.op.text + '(' + node.lhs.type.name + ',' + node.rhs.type.name + ')';

        if (sig in glsl.builtins.OperatorMap) {
            node.type = glsl.builtins.OperatorMap[sig].ret;
        } else {
            this._error(node.location(), 'cannot use the \'' + node.op.text + '\' operator on types ' + node.lhs.type.name + ' and ' + node.rhs.type.name);
        }
    }
}

Annotator.prototype._annotate_unary_op_expr = function(node) {
    this._annotate_node(node.expression);

    node.type = null;

    if (node.expression.type === null) {
        return;
    }

    var sig = node.op.text + '(' + node.expression.type.name + ')';

    if (sig in glsl.builtins.OperatorMap) {
        node.type = glsl.builtins.OperatorMap[sig].ret;
    } else {
        this._error(node.location(), 'cannot use the \'' + node.op.text + '\' operator on type ' + node.expression.type.name);
    }
}

Annotator.prototype._annotate_unary_postfix_op_expr = function(node) {
    this._annotate_unary_op_expr(node);
}

Annotator.prototype._annotate_ternary_expr = function(node) {
    this._annotate_node(node.condition);
    this._annotate_node(node.true_expression);
    this._annotate_node(node.false_expression);

    node.type = null;

    if (node.condition.type !== null && node.condition.type != glsl.builtins.Bool.type.type) {
        this._error(node.condition.location(), 'the condition of a ternary conditional expression must be of type bool');
    }

    if (node.true_expression.type === null && node.false_expression === null) {
        return;
    }

    if (node.true_expression.type === null) {
        node.type = node.false_expression.type;
    } else if (node.false_expression.type === null) {
        node.type = node.true_expression.type;
    } else if (node.true_expression.type != node.false_expression.type) {
        this._error(node.true_expression.location().extend(node.false_expression.location()),
                    'the true expression and false expression must be of the same type, but got ' + node.true_expression.type.name + ' and ' + node.false_expression.type.name);
        node.type = node.true_expression.type;
    } else {
        node.type = node.true_expression.type;
    }
}

Annotator.prototype._annotate_index_expr = function(node) {
    this._annotate_node(node.expression);
    this._annotate_node(node.index);

    node.type = null;

    var et = node.expression.type;

    if (et !== null) {
        if (et.length <= 1) {
            this._error(node.expression.location(), 'the expression cannot be indexed');
        } else if (node.index.type !== null && node.index.type.is_const_expression && node.index.type.const_value >= et.length) {
            this._error(node.index.location(), 'index out of bounds, trying to index element ' + node.index.type.const_value + ' in a value of length ' + et.length);
        } else if (et.is_builtin) {
            if (et.is_mat) {
                if (et.length == 2) {
                    node.type = glsl.builtins.Vec2.type.type;
                } else if (et.length == 3) {
                    node.type = glsl.builtins.Vec3.type.type;
                } else if (et.length == 4) {
                    node.type = glsl.builtins.Vec4.type.type;
                }
            } else if (et.is_float) {
                node.type = glsl.builtins.Float.type.type;
            } else if (et.is_int) {
                node.type = glsl.builtins.Int.type.type;
            } else if (et.is_bool) {
                node.type = glsl.builtins.Bool.type.type;
            }
        } else {
            node.type = et.element_type;
        }
    }

    if (node.index.type !== null && (!node.index.type.is_const_expression || node.index.type != glsl.builtins.Int.type.type)) {
        this._error(node.index.location(), 'expected constant integer index expression');
    }
}

Annotator.prototype._annotate_field_selection_expr = function(node) {
    this._annotate_node(node.expression);

    node.type = null;

    var et = node.expression.type;

    if (et === null) {
        return;
    }

    var s = node.selector.text;

    if (et.is_builtin) {
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

            node.type = glsl.builtins.TypeMap[tps[s.length]].type.type;

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
                                'selector out of bounds, expression has only ' + node.expression.type.length + ' components, but tried to select component ' + (ci + 1));
                    return;
                }
            }
        } else {
            this._error(node.expression.location().extend(node.op.location), 'selector \'' + s + '\' does not apply to an expression of type ' + et.name);
        }
    } else {
        // Select on field in user defined type
        var fields = et.decl.fields;

        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];

            if (field.name.text == s) {
                node.type = field.type.type;
                return;
            }
        }

        this._error(node.selector.location, 'the field \'' + s + '\' does not exist in the struct type ' + et.name);
    }
}

Annotator.prototype._error = function(loc, message) {
    this._errors.push(new Error(loc, message));
}

exports.Annotate = Annotate;

exports.UserType = UserType;

})(ns);

// vi:ts=4:et
