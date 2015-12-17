// maybe add a kind of stack trace next time
function ContextError(pos, endPos, node, msg){
    this.pos = pos;
    this.endPos = endPos;
    this.node = node;
    this.msg = msg;

    this.toString = function(){
        return this.msg+" "+this.node;
    }
}

function InternalError(pos, endPos, node, msg, jspos, filename){
    this.pos = pos;
    this.endPos = endPos;
    this.node = node;
    this.msg = msg;
    this.jspos = jspos;
    this.filename = filename

    this.toString = function(){
        return this.msg+" at "+this.jspos+" while evaluating "+this.node;
    }
}

function MtyInterpreter(ast, printfn, readfn){
    this.ast = ast;

    var _printfn = printfn || function(msg){ console.log(msg); };
    var _readfn = readfn || function(){ return prompt(); };

    var _abortBlock = undefined;
    var _actions = {};
    var currentNode = undefined;

    var _eval = function(node, lvalue){
        lvalue = lvalue || false;
        currentNode = node;
        return _actions[node.name](node, lvalue);
    };
    var _blockStack = [];

    var _returnValue = undefined;
    var _getReturnValue = function(){
        var val = _returnValue; 
        _returnValue = undefined;
        return val;
    }

    var _setReturnValue = function(val){
        _returnValue = val;
    }

    var _resolveSelf = function(){
        var blockIndex = _blockStack.length-1;
        var result = undefined;
        while((result == undefined)&&(blockIndex >= 0)){
            result = _blockStack[blockIndex].instance;
            blockIndex--;
        }
        if(result == undefined){
            throw new ContextError(currentNode.pos, currentNode.endPos,
                        currentNode, "The 'self' keyword may only be used "
                        + "inside methods of a class'");
        }
        return result;
    }

    var _resolveVariable = function(variableName, isMemberAccess){
        var blockIndex = _blockStack.length-1;
        var result = undefined;
        if(isMemberAccess){
            var classBlock = {blockType : undefined};
            while((classBlock.blockType != "class")&&(blockIndex >= 0)){
                classBlock = _blockStack[blockIndex];
                blockIndex--;
            }
            if(classBlock.blockType == "class"){
                result = classBlock.resolveVariable(variableName);
            }
        }
        else {
            while((result == undefined)&&(blockIndex >= 0)){
                if((_blockStack[blockIndex].blockType != "class")
                    ||(_blockStack[blockIndex] == _blockStack.peek()))
                {
                    result = _blockStack[blockIndex]
                                .resolveVariable(variableName);
                }
                blockIndex--;
            }
        }
        return result;
    }

    var _resolveFunction = function(functionName, isMemberAccess){
        var blockIndex = _blockStack.length-1;
        var result = undefined;
        // TODO: overload resolution
        if(isMemberAccess){
            var classBlock = {blockType : undefined};
            while((classBlock.blockType != "class")&&(blockIndex >= 0)){
                classBlock = _blockStack[blockIndex];
                blockIndex--;
            }
            if(classBlock.blockType == "class"){
                result = classBlock.resolveFunction(functionName);
            }
        }
        else {
            while((result == undefined)&&(blockIndex >= 0)){
                if((_blockStack[blockIndex].blockType != "class")
                    ||(_blockStack[blockIndex] == _blockStack.peek()))
                {
                    result = _blockStack[blockIndex]
                            .resolveFunction(functionName);
                }
                blockIndex--;
            }
        }
        return result;
    }

    var _resolveClass = function(className){
        var blockIndex = _blockStack.length-1;
        var result = undefined;
        
        while((result == undefined)&&(blockIndex >= 0)){
            result = _blockStack[blockIndex].resolveClass(className);
            blockIndex--;
        }
        return result;
    }

    // -------------------------------------------------------------------------
    // -- evaluation action functions ------------------------------------------
    // -------------------------------------------------------------------------
    
    _actions['WhileLoop'] = function(node) {
        while(_eval(node.condition).getValue()){
            _eval(node.body);
            if(_abortBlock != undefined){
                if(_abortBlock.command == "skip"){
                    _abortBlock = undefined;
                    continue;
                }
                else if(_abortBlock.command == "break"){
                    _abortBlock = undefined;
                    break;
                }
                else if(_abortBlock.command == "return"){
                    break;
                }
            }
        }
    }

    _actions['IfStatement'] = function(node) {
        if(_eval(node.condition).getValue()){
            _eval(node.trueBody);
        }
        else{
            _eval(node.falseBody);
        }
    }

    _actions['Literal'] = function(node) {
        return node;
    }

    _actions['SelfExpression'] = function(node) {
        return _resolveSelf();
    }

    _actions['MethodCall'] = function(node) {
        _eval(node.memberAccess);
    }

    var classInstantiation = function(node, clsDecl){
        var instance = clsDecl.createInstance(node);
        instance.block.instance = instance;

        // evaluate the initialization statements
        _eval(instance.block);

        // call the initializer (if there is one)
        _blockStack.push(clsDecl.block);
        _blockStack.push(instance.block);
        try{
            var initCall = mtyParser.createFunctionCall(node.pos, node.endPos,
                                    "initializer", node.parameters);
            initCall.isMemberAccess = true;
            _eval(initCall);
        } catch(err) {
            if(err.msg != "The method 'initializer' could not be resolved."){
                throw(err);
            }
        }
        _blockStack.pop();
        _blockStack.pop();

        return instance;
    }

    _actions['FunctionCall'] = function(node) {
        var clsDecl = _resolveClass(node.functionName);
        if(clsDecl != undefined){
            return classInstantiation(node, clsDecl);
        }else{
            var funDecl = _resolveFunction(node.functionName,
                                            node.isMemberAccess);
            if(funDecl == undefined){
                switch(node.functionName){
                    case "print":
                        var param = _eval(node.parameters[0]);
                        _printfn(""+param.getValue());
                        break;
                    case "println":
                        var param = _eval(node.parameters[0]);
                        _printfn(""+param.getValue() + "\n");
                        break;
                    default:
                        var funType = node.isMemberAccess ?
                                    "method" : "function";
                        throw new ContextError(node.pos, node.endPos, node,
                            "The "+funType+" '"+node.functionName
                            +"' could not be resolved.");
                }
            }
            else{
                var contents = [];
                var argc = node.parameters ? node.parameters.length : 0;
                var parc = funDecl.parameters ? funDecl.parameters.length : 0;

                for(var i=0; i < parc; i++){
                    if(i < argc){
                        var param = funDecl.parameters[i];
                        if(Array.isArray(param)){ param = param[0]; }
                        var arg = node.parameters[i];
                        var varaccess = mtyParser.createVariableAccess(arg.pos,
                                                            arg.endPos,
                                                            param.variableName);
                        contents.push(param);
                        contents.push(mtyParser.createAssignment(arg.pos,
                                                                arg.endPos,
                                                                varaccess, arg));
                    }
                    else{
                        var param = funDecl.parameters[i][0];
                        var assign = funDecl.parameters[i][1];
                        contents.push(param);
                        contents.push(assign);
                    }
                }
                var paramBlock = mtyParser.createBlock(funDecl.pos, funDecl.endPos,
                                                        contents, "parameters");

                _eval(paramBlock);
                // the param block is a parent block of the function body block
                // this way, the parameter declarations are visible within the
                // function body
                _blockStack.push(paramBlock);
                _eval(funDecl.body);
                _blockStack.pop();

                _abortBlock = undefined;
                return _getReturnValue();
        }
        }
    }

    /* declarations are not processed by the interpreter for now
       this may be used when a REPL is implemented
    _actions['VariableDeclaration'] = function(node) {}
    _actions['FunctionDeclaration'] = function(node) {}
    _actions['ClassDeclaration'] = function(node) {}
    */

    _actions['VariableAccess'] = function(node, lvalue) {
        var vardecl = _resolveVariable(node.variableName, node.isMemberAccess);
        if(vardecl == undefined){
            var varType = node.isMemberAccess ? "attribute" : "variable";
            throw new ContextError(node.pos, node.endPos,
                        node, "The "+varType+" '"+node.variableName
                        +"' could not be resolved.");
        }
        if(! lvalue){vardecl = vardecl.getValue(); }
        return vardecl;
    }

    _actions['Assignment'] = function(node) {
        var lvalue = _eval(node.left, true);
        var rvalue = _eval(node.right);
        // TODO: type check
        lvalue.value = rvalue;
    }

    _actions['CommandStatement'] = function(node) {
        // TODO: implement
        switch(node.command){
            case 'return':
                if(node.argument){
                    _setReturnValue(_eval(node.argument));
                }
                _abortBlock = node;
                break;
            case 'yield':
                break;
            case 'raise':
                break;
            case 'skip': // node.argument always undefined
                _abortBlock = node;
                break;
            case 'break': // node.argument always undefined
                _abortBlock = node;
                break;
        }
    }

    var _checkAbortBlock = function(node){
        if((_abortBlock.command == "break")||(_abortBlock.command == "skip")){
            if((node.blockType == "function")||(node.blockType == "module")){
                throw new ContextError(node.pos, node.endPos, node,
                        "Invalid "+_abortBlock.command
                        +" statement outside loop.");
            }
        }
        else if(_abortBlock.command == "return"){
            if(node.blockType == "module"){
                throw new ContextError(node.pos, node.endPos, node,
                        "Invalid return statement outside function.");
               
            }
        }
    }

     _actions['Block'] = function(node) {
        _blockStack.push(node);
        var stmts = node.statements;
        for(var i = 0; i < stmts.length; i++){
            _eval(stmts[i]);
            if(_abortBlock != undefined){
                _checkAbortBlock(node);
                break;
            }
        }
        _blockStack.pop();
    }

    _actions['UnaryExpression'] = function(node) {
        switch(node.operator){
            case '-':
                break;
            case 'not':
                break;
        }
    }

    var _memberAccess = function(node, lvalue){
        var left = _eval(node.left).getValue()
        var right;
        _blockStack.push(left.block);
        node.right.isMemberAccess = true;
        right = _eval(node.right, lvalue);
        _blockStack.pop();

        return right;
    }

    _actions['BinaryExpression'] = function(node, lvalue) {
        if(node.op == "."){
            return _memberAccess(node, lvalue);
        }

        var left = _eval(node.left).getValue();
        var right = _eval(node.right).getValue();

        // result = new Expression();
        result = mtyParser.createExpression();
        switch(node.op){
            case '+':
                result.value = left + right;
                break;
            case '-':
                result.value = left - right;
                break;
            case '*':
                result.value = left * right;
                break;
            case '/':
                result.value = left / right;
                break;
            case '%':
                result.value = left % right;
                break;
            case '^':
                result.value = Math.pow(left, right);
                break;
            case '=':
                result.value = left === right;
                break;
            case '!=':
                result.value = left !== right;
                break;
            case '<':
                result.value = left < right;
                break;
            case '>':
                result.value = left > right;
                break;
            case '<=':
                result.value = left <= right;
                break;
            case '>=':
                result.value = left >= right;
                break;
        }
        return result;
    }

    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------

    this.run = function(){
        try{
            _eval(ast);
        }
        catch(err){
            if(err.constructor.name == "ContextError"){
                err.type = "ContextError";
                throw err;
            }
            else{
                err.type = "__internal__";
                if(currentNode == undefined){
                    currentNode = {
                        name : "",
                        pos : mtyParser.createPos(-1,-1),
                        endPos : mtyParser.createPos(-1,-1)
                    }
                }
                var err = new InternalError(currentNode.pos, currentNode.endPos,
                                        currentNode, err.message,
                                        mtyParser.createPos(err.lineNumber,
                                                            err.columnNumber),
                                        err.fileName);
                err.type = "InternalError";
                throw err;
            }
        }
    }
}