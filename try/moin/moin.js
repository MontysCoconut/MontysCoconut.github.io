/**
 * This function loads javascript files and executes a callback function
 * when the code is loaded. It is possible to provide either one string
 * parameter or a list of string parameters:
 *
 * loadScripts("script.js", function(){alert("done");})
 * loadScripts(["script1.js", "script2.js"], function(){alert("done");})
 * 
 * The callback parameter may be omitted
**/
function loadScripts(urls, callback)
{
    var intermediateCallback = callback;
    var url = urls;
    if(Array.isArray(urls)){
        var url = urls.shift();
        if(urls.length > 0){
            intermediateCallback = function(){loadScripts(urls, callback);}
        }
    }
    console.log("loading "+url);
    var head = document.getElementsByTagName("head")[0];
    var script = document.createElement("script");
    script.type = "application/javascript";
    script.src = url;
    script.onreadystatechange = intermediateCallback;
    script.onload = intermediateCallback;
    head.appendChild(script);
}

var mtyParser = null;
var MtyInterpreter = undefined;

function moin(code, options){
    options = options || {};
    var done = options.done || function(){
        console.log("-- interpreter stopped --")};
    var print = options.print || function(msg){console.log("print: "+msg)};
    var read = options.read || function(){return prompt();};
    var err = options.err || function(msg){console.log("ERROR: "+msg)};
    var scriptpath = options.scriptpath || "";
    if((scriptpath)&&(scriptpath.charAt(scriptpath.length-1) != "/")){
        scriptpath += "/"
    }

    var startWorker = function(){
        var worker = new Worker(scriptpath+"worker.js");
        if(err){
            worker.addEventListener("error", err);
        }
        worker.addEventListener("message", function(e) {
            var data = e.data;
            switch(data.cmd){
                case "print":
                    print(data.value);
                    break;
                case "error":
                    var error = JSON.parse(data.error);
                    error.toString = function(){return error.string;};
                    err(error);
                    break;
                case "done":
                    worker.terminate();
                    done();
                    break;
            }
        }, false);
        worker.postMessage({cmd:"run", code:code}); // Start the worker.
    }

    var startWithoutWorker = function(){
        try{
            var ast = mtyParser.parse(code);
            var interpreter = new MtyInterpreter(ast, print);
            interpreter.run();
        }
        catch(error){
            err(error);
        }
        done();
    }

    if((!mtyParser)||(MtyInterpreter === undefined)){
        loadScripts([scriptpath+"parser.js",
                    scriptpath+"interpreter.js"],
        function(){
            if(typeof(Worker) !== "undefined") {
                startWorker();
            }
            else{
                setTimeout(function(){startWithoutWorker();}, 10);
            }
        });
    }
    else{
        if(typeof(Worker) !== "undefined") {
            startWorker();
        }
        else{
            setTimeout(function(){startWithoutWorker();}, 10);
        }
    }
}