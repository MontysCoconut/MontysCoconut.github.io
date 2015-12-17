var nextFun = null;
var prevFun = null;
var currentChallenge = null;
var currentLevelIndex = null;
var _onloadFunction = null;


function contentLoaded(){
    if(_onloadFunction){
        _onloadFunction();
        _onloadFunction = null;
    }
}

function startThrobber(){
    var cm = $("#right-editor + .CodeMirror");
    cm.find(".faultyCode").removeClass("faultyCode");
    terminal.disableInput($("#right-terminal"));
    $("#throbberplane").show();
}

function stopThrobber(){
    var term = $("#right-terminal");
    terminal.enableInput(term);
    $("#throbberplane").hide();
    terminal.scrollDown(term);
}

function updatePanelWidth(){
    var width = $('#content').outerWidth(true)+36;
        
    $("#toolbar").css("width", $('#content').outerWidth(true)+36+"px");
    $("#control").css("width", $('#content').outerWidth(true)+36+"px");
}

function next(){
    if(nextFun){
        nextFun();
        return true;
    }
    return false;
}

function prev(){
    if(prevFun){
        prevFun();
        return true;
    }
    return false;
}

function setNextFun(_nextFun){
    if(!_nextFun){
        $(".next").addClass("inactive");
    }
    else{
        $(".next").removeClass("inactive");
    }
    nextFun = _nextFun;
}

function setPrevFun(_prevFun){
    if(!_prevFun){
        $(".prev").addClass("inactive");
    }
    else{
        $(".prev").removeClass("inactive");
    }
    prevFun = _prevFun;
}


function loadContent(content){
    var left = $('#content');
    left.fadeOut(400, function(){
        left.html(content);
        left.fadeIn(400, function(){
            contentLoaded();
            updatePanelWidth();
        });
    });
}

function loadStaticHtml(name){
    history.pushState(null, "", "?page="+encodeURIComponent(name));
    setNextFun(null);
    setPrevFun(null);
    setLevel(null);
    currentChallenge = null;
    $.get("static/html/"+name+".html", function(data){
        loadContent(data);
    });
}

function htmlDecode(input){
    var e = document.createElement('div');
    e.innerHTML = input;
    return e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue;
}

function loadChallengeOverview(){
    $.get("challenges.yaml", function(data){
        var challenges = jsyaml.load(data)['challenges'];

        var list = "<table>";
        var i;
        for(i = 0; i < challenges.length; ++i) {
            var challenge = challenges[i];
            list +=  '<tr>'
                    +'<th colspan="2">'
                    +challenge['title']
                    +"</th></tr>"

                    +"<tr>" 
                    +'<td>'+challenge['description']
                    // +'<br/><i class="small">(by '
                    // +challenge['author']+")</i>"
                    +"</td>"
                    +'<td><button class="btn small nobr" '
                    +'onclick="loadChallenge(\''
                    + challenge["file"]+'\')">Start '
                    +'<span class="fa fa-chevron-right"></span></button></td>'
                    +"</tr>";
        }
        history.pushState(null, "", "?overview=challenges");
        loadContent('<h1>List of Challenges</h1>'+list+"</dl>");

        setNextFun(null);
        setPrevFun(null);

        setLevel(null);
        currentChallenge = null;
    });
}

function loadChallenge(name, index){
    index = index || 0;
    $("#levelprogress > div").css("width", 0);
    $.get("challenges/"+name+".yaml", function(data){
        currentChallenge = jsyaml.load(data);
        if(index >= currentChallenge.levels.length){
            setLevel(0);
            showErrorDialog("Error", "The given level index is invalid. "
                    +"Automatically switched to the challenge introduction.");
        }
        else{
            setLevel(index);
        }

        history.pushState(null, "", "?challenge="+encodeURIComponent(name)
                                    +"&level="+encodeURIComponent(index));
        loadContent(
            renderLevel(currentChallenge["levels"][currentLevelIndex])
        );
        setNextFun(challengeNextFun);
        if(index == 0){
            setPrevFun(null);
        }
        else{
            setPrevFun(challengePrevFun);
        }
    }).fail(function(){
        showErrorDialog("Error", "The challenge could not be loaded, "
                            +"since the request for the file failed.");
    });
}

function setLevel(level){
    if(level === null){
        $("#levelprogress").fadeOut();
        $("#levelprogress-label").fadeOut();
    }
    else{
        if(!($("#levelprogress").is(":visible"))
        || (!$("#levelprogress-label").is(":visible")))
        {
            $("#levelprogress").fadeIn();
            $("#levelprogress-label").fadeIn();
        }
        currentLevelIndex = level;
        var totalLevels = currentChallenge["levels"].length;
        $("#levelprogress-label span:first-child").html(level+1);
        $("#levelprogress-label span:last-child").html(totalLevels);

        var percent = ((level+1)/totalLevels)*100;
        $("#levelprogress > div").css("width", percent+"%");
    }
}

function validate(){
    var level = currentChallenge["levels"][currentLevelIndex];
    var type = level["type"];
    if(type == "quiz"){
        // get the given answers
        var answers = [];
        $('#quiz input:checked').each(function(index, element){
            answers.push(element.value);
        });
        
        // compare the given answers with the solution
        var solution = level["solution"];
        if(! (solution instanceof Array)){
            solution = [solution];
        }
        // check if both arrays have the same length
        if(answers.length != solution.length){
            return false;
        }
        // check whether every element of the solution is also in the answer
        for(var i=0; i < solution.length; i++){
            if($.inArray(""+solution[i], answers) < 0){
                return false;
            }
        }
        return true;
    }
    else if(type == "cloze"){
        var solution = currentChallenge["levels"]
                                        [currentLevelIndex]["solution"];
        var valid = true;
        var gaps = $('#cloze .gap').each(function(index, element){
            if(element.value != solution[index]){
                valid = false;
            }
        });
        return valid;
    }
    else if(type == "api"){
        return true; // TODO
    }
    else{
        // for all other types (such as text), there is no validation necessary
        return true;
    }
}

function challengeNextFun(){
    var currentLevel = currentChallenge["levels"][currentLevelIndex];
    // validate the user's input. We can only proceed if the input was correct.
    if(validate()){
        // only show a message for tasks, not for text levels
        if(currentLevel["type"] != "text"){
            var message = "The answer was correct";
            if(currentLevel["passMessage"]){
                message = currentLevel["passMessage"];
            }
            showMessageDialog("Pass", message, "fa-check");
        }

        setLevel(currentLevelIndex+1)
        if(currentLevelIndex > 0){
            setPrevFun(challengePrevFun);
        }

        if(currentLevelIndex >= currentChallenge["levels"].length){
            setLevel(currentLevelIndex-1);
            loadChallengeOverview();
        }
        else{
            history.pushState(null, "", "?challenge="
                            +encodeURIComponent(getGET()["challenge"])
                            +"&level="+encodeURIComponent(currentLevelIndex));

            loadContent(renderLevel(currentChallenge["levels"]
                [currentLevelIndex])
            );
        }
    }
    else{
        // failed to validate:
        var message = "The answer was wrong";
        if(currentLevel["failMessage"]){
            message = currentLevel["failMessage"];
        }
        showMessageDialog("Fail", message, "fa-times");
    }
}

function challengePrevFun(){
    setLevel(currentLevelIndex-1)
    if(currentLevelIndex == 0){
        setPrevFun(null);
    }
    history.pushState(null, "", "?challenge="
                +encodeURIComponent(getGET()["challenge"])
                +"&level="+encodeURIComponent(currentLevelIndex));
    loadContent(renderLevel(currentChallenge["levels"]
        [currentLevelIndex])
    );
}

function showDialog(title, content){
    $('.dialog .title').html(title);
    $('.dialog .content').html(content);

    $('.modal').fadeIn();
    $('.dialog').slideDown();
}

function showDialogFromStaticHtml(title, name){
    $.get("static/html/"+name+".html", function(data){
        showDialog(title, data);
    });
}

function showMessageDialog(title, content, icon){
    html = '';
    if(icon){
        html += '<p class="icon colored">'
                +'<span class="fa '+icon+'"></span></p>\n'
                +'<p class="icon-text">';
    }
    else{
        html += '<p>';
    }
    html += content
            +"\n</p>\n<center style=\"clear: both\"><button class=\"btn\""
            +"onclick=\"hideDialog()\">Ok</button></center>";
    showDialog(title, html);
}

function showErrorDialog(title, content){
    content = '<p class="icon error">'
            +'<span class="fa fa-warning"></span></p>\n'
            +'<p class="icon-text">'
            +content
            +"\n</p>\n<center style=\"clear: both\"><button class=\"btn\""
            +"onclick=\"hideDialog()\">Ok</button></center>";
    showDialog(title, content);
}

function hideDialog(){
    $('.modal').fadeOut();
    $('.dialog').slideUp();
}

function renderLevelCloze(data){
    _onloadFunction = function(){
        CodeMirror.runMode(data['cloze'], "text/x-monty",
                            document.getElementById("cloze"));
        var gaps = [];
        $('#cloze span').each(
            function(index, element){
                if(element.innerHTML == "____"){
                    var gap = $('<input type="text" class="gap" size="4"/>');
                    gap.on('input', function(){
                        var len = gap.val().length;
                        if(len <= 0){
                            len = 1;
                        }
                        gap.attr('size', len);
                    });
                    $(element).replaceWith(gap);
                    gaps.push(gap);
                }
            }
        );
    };
    return "<h1>"+data["title"]+"</h1>\n"
        + data["text"]
        + '<pre id="cloze" class="cm-s-default"></pre>'
    ;
}

function renderLevelAPI(data){
    var code = "";
    if(data["code"]){
        code = data["code"];
    }
    _onloadFunction = function(){
        function commandRunCode(){
            var term = $("#right-terminal");
            terminal.fireCommand(term, "moin");
        }
        createEditor("api");
    };
    return "<h1>"+data["title"]+"</h1>\n"
        + data["text"]
        + '<textarea class="api" id="api">'+code+'</textarea>'
    ;
}

function renderLevelQuiz(data){
    var output = "<h1>"+data["title"]+"</h1>\n"
                + data["question"];

    output += '<form id="quiz">\n<fieldset>\n';
    // multiple choice
    if(data["solution"] instanceof Array){
        var i;
        for(i=0; i < data["answers"].length; i++){
            output += '<input type="checkbox" name="answer" '+
                        'value ="'+data["answers"][i]+'"/><label>'
                        +data["answers"][i]+"</label><br/>";
        }
    }
    // single choice
    else{
        var i;
        for(i=0; i < data["answers"].length; i++){
            output += '<input type="radio" name="answer" '+
                        'value ="'+data["answers"][i]+'"/><label>'
                        +data["answers"][i]+"</label><br/>";
        }
    }
    output += "</fieldset>\n</form\n";

    output = $("<div>"+output+"</div>");
    output.find("pre").each(function(key, value){
        var text = htmlDecode(value.innerHTML);
        CodeMirror.runMode(text, "text/x-monty", value);
    });

    return output.html();
}

function renderLevelText(data){
    var output = $("<div><h1>"+data["title"]+"</h1>\n"+data["text"]+"</div>");

    output.find("pre").each(function(key, value){
        var text = htmlDecode(value.innerHTML);
        CodeMirror.runMode(text, "text/x-monty", value);
    })
    console.log(output);

    return output.html();
}

// loads 
function renderLevel(data){
    if(data.type == "text"){
        return renderLevelText(data);
    }
    else if(data["type"] == "cloze"){
        return renderLevelCloze(data);
    }
    else if(data["type"] == "quiz"){
        return renderLevelQuiz(data);
    }
    else if(data["type"] == "api"){
        return renderLevelAPI(data);
    }
    else{
        return showErrorDialog("Error", "The level could not be loaded, because "
                            +"it has an invalid type '"+data["type"]+"'.");
    }
}


function getGET(){
    var params = window.location.search.substring(1).split('&');
    var variables = {};
    for(var i=0; i < params.length; i++){
        var value = params[i].split('=');
        variables[decodeURIComponent(value[0])] = decodeURIComponent(value[1]);
    }
    return variables;
}

function doRouting(){
    var route = getGET();
    if(route["challenge"]){
        var level = 0;
        if(route["level"]){
            level = parseInt(route["level"]);
        }
        loadChallenge(route["challenge"], level);

    }
    else if(route["overview"] == "challenges"){
        loadChallengeOverview();
    }
    else if(route["page"]){
        loadStaticHtml(route["page"]);
        if(route["page"] == "index"){
            setNextFun(loadChallengeOverview);
        }
    }
    else{
        loadStaticHtml('index');
        setNextFun(loadChallengeOverview);
    }
}

function createEditor(id) {
    function commandRunCode(){
            var term = $("#right-terminal");
            terminal.fireCommand(term, "moin");
    }
    return CodeMirror.fromTextArea(document.getElementById(id),
            {
                indentUnit:     4,
                tabSize:        4,
                indentWithTabs: false,
                lineNumbers:    true,
                extraKeys: {
                                "Tab" : function(cm) {
                                    var spaces = Array(
                                        cm.getOption("indentUnit")+1).join(" ");
                                    cm.replaceSelection(spaces);
                                },
                                "Shift-Tab" : function(cm) {
                                    var line = cm.getCursor().line;
                                    var length = cm.getLine(line).length
                                    cm.indentLine(line, -4);
                                    if(cm.getLine(line).length == 0){
                                        var spaces = Array(
                                            length-4+1).join(" ");
                                        cm.replaceSelection(spaces);
                                    }
                                },
                                "Ctrl-Enter" : function(cm){
                                    commandRunCode();
                                },
                                "Alt-Enter" : function(cm){
                                    commandRunCode();
                                },
                            }

            });
}