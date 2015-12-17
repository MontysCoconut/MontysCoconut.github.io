importScripts('parser.js', 'interpreter.js');

self.postMessage("Worker Started!");

function print(msg){
    self.postMessage({cmd: "print", value:msg});
}

self.addEventListener('message', function(e) {
    if(e.data.cmd == "run"){
        self.postMessage({cmd:"started"});

        try{
            var ast = mtyParser.parse(e.data.code+"\n");
            var interpreter = new MtyInterpreter(ast, print);
            interpreter.run();
        }
        catch(err){
            var error = err;
            if(error.name == "SyntaxError"){
                error.type = "SyntaxError";
                error.pos = mtyParser.createPos(error.location.start.line,
                                                error.location.start.column);
                error.endPos = mtyParser.createPos(error.location.end.line,
                                                error.location.end.column);

                error.string = error.toString()+" at "+error.pos;
            }else{
                error.string = err.toString();
            }
            self.postMessage({cmd:"error", error : JSON.stringify(error)});
        }

        self.postMessage({cmd:"done"});
    }
    else{
        self.postMessage("other message");
    }
}, false);