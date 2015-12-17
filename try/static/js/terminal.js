String.prototype.repeat = function( num )
{
    return new Array( num + 1 ).join( this );
}

var terminal =
{
    // initialize a terminal which replaces the given element
    init : function(element, options){
        // prepare input
        element = $(element);

        // generate DOM subtree
        var _terminal = $('<div></div>');
        _terminal.addClass('terminal');

        // some data has to be set before the actual terminal is created
        _terminal.data('commandHistory', []);
        _terminal.data('commandStep', 0);
        _terminal.data('options', {});
        terminal.setOptionsDefault(_terminal);
        terminal.setOptions(_terminal, options);

        var _hiddenInput = $('<input type="text" class="hiddenInput"/>');
        var _currentLine = $('<span class="currentLine" tabindex="0"></span>');
        var _prompt = $('<span class="prompt">'
                        +_terminal.data('options').prompt+'</span>');
        var _prev = $('<span></span>');
        var _caret = $('<span class="textcursor term-blink end"> </span>');
        var _next = $('<span></span>');

        _currentLine.append(_prompt).append(_prev).append(_caret).append(_next);
        _terminal.append(_currentLine);
        _terminal.prepend(_hiddenInput);

        _terminal.data('currentLine', _currentLine);
        _terminal.data('input', _hiddenInput);
        _terminal.data('prompt', _prompt);
        _terminal.data('prev', _prev);
        _terminal.data('caret', _caret);
        _terminal.data('next', _next);

        // --- define handlers -------------------------------------------------
        // set focus to currentLine when terminal is clicked -------------------
        var onclick = function(evt){
            _hiddenInput.focus();
        };

        // Insert Charcters when a key is pressed ------------------------------
        var onchange = function(evt){
            var txt = _hiddenInput.val();
            _caret.prev().append(txt);
            _hiddenInput.val('');
        };

        // Catch special keys before a character is inserted -------------------
        var keydown = function(evt){
            if(!_currentLine.is(":visible")){
                return;
            }
            var char = evt.keyCode;

            var textBefore = _caret.prev().text();
            var textAfter = _caret.next().text();

            switch(char){
                case 8: // BACKSPACE
                    evt.preventDefault();
                    _caret.prev().text(textBefore.slice(0,-1));
                    break;
                case 46: // DEL
                    evt.preventDefault();
                    var firstChar = textAfter.slice(0,1);
                    _caret.html(firstChar);
                    _caret.next().text(textAfter.slice(1));
                    break;
                case 9: // TAB
                    evt.preventDefault();
                    if(evt.shiftKey) // dedent
                    {
                        var position = textBefore.length;
                        var textWhole = textBefore+_caret.text()+textAfter;
                        var trimmed = textWhole;
                        for(i=0; i < 4; i++)
                        {
                            trimmed = trimmed.replace(/^\s/, '');
                        }
                        position -= textWhole.length - trimmed.length;
                        if(position < 0){position = 0;}
                        textBefore = trimmed.substr(0, position);
                        textAfter = trimmed.substr(position+1);
                        _caret.text(trimmed.substr(position, 1));
                        _caret.prev().text(textBefore);
                        _caret.next().text(textAfter);
                    }
                    else // indent
                    {
                        _caret.prev().text(textBefore+'    ');
                    }
                    break;
                case 37: // LEFT
                    evt.preventDefault();
                    // if the ctrl key is pressed, we move until the next
                    // non-character symbol
                    if(evt.ctrlKey){
                        if(textBefore == ''){return;}

                        if(_caret.hasClass('end'))
                        {
                            _caret.text('');
                            _caret.removeClass('end');
                        }

                        var pattern = /([A-Za-z][^A-Za-z]|[0-9][^0-9])/g;
                        var matches = [];
                        while ((match = pattern.exec(textBefore)) != null){
                            matches.push(match.index);
                        }
                        if(matches.length > 0){
                            // if there was a word separation, jump there
                            var newIndex = matches[matches.length-1]+1;
                            _caret.prev().text(
                                            textBefore.substring(0,newIndex));
                            _caret.next().text(textBefore.substring(newIndex+1)
                                               +_caret.text()
                                               +_caret.next().text());
                            _caret.text(textBefore.charAt(newIndex));
                        } else {
                            // if there was no word separation, perform as if
                            // the home button was pressed
                            evt.keyCode = 36; // HOME KEY
                            keydown(evt);
                            return;
                        }
                    }
                    // if not, we just move one character to the left
                    else{
                        var lastChar = textBefore.slice(-1);
                        if(lastChar == ''){return;}
                        if(_caret.hasClass('end'))
                        {
                            _caret.text('');
                            _caret.removeClass('end');
                        }
                        _caret.next().text(_caret.text()+textAfter);
                        _caret.text(lastChar);
                        _caret.prev().text(textBefore.slice(0, -1));
                    }
                    _caret.removeClass('term-blink');
                    setTimeout(function(){_caret.addClass('term-blink')}, 1000);
                    break;
                case 39: // RIGHT
                    evt.preventDefault();
                    if(_caret.hasClass('end')){return;}
                    // if the ctrl key is pressed, we move until the next
                    // non-character symbol
                    if(evt.ctrlKey){
                        var textAfter = _caret.next().text();

                        var pattern = /([A-Za-z][^A-Za-z]|[0-9][^0-9])/g;
                        match = pattern.exec(textAfter);
                        if(match){
                            // if there was a word separation, jump there
                            var newIndex = match.index+1;
                            _caret.prev().text(textBefore+_caret.text()
                                            +textAfter.substring(0,newIndex));
                            _caret.next().text(textAfter.substring(newIndex+1));
                            _caret.text(textAfter.charAt(newIndex));
                        } else {
                            // if there was no word separation, perform as if
                            // the home button was pressed
                            evt.keyCode = 35; // END KEY
                            keydown(evt);
                            return;
                        }
                    }
                    else{
                        var firstChar = textAfter.slice(0,1);
                        _caret.prev().text(textBefore+_caret.text());
                        if(firstChar == ''){
                            firstChar = ' ';
                            _caret.addClass('end');
                        }
                        _caret.text(firstChar);
                        _caret.next().text(textAfter.slice(1));
                    }
                    _caret.removeClass('term-blink');
                    setTimeout(function(){_caret.addClass('term-blink')}, 1000);
                    break;
                case 38: // UP
                    evt.preventDefault();
                    var step = _terminal.data('commandStep');
                    if(step > 0){
                        step--;
                        terminal.setInput(_terminal,
                                 _terminal.data('commandHistory')[step]);
                        _terminal.data('commandStep', step);
                    }
                    break;
                case 40: // DOWN
                    evt.preventDefault();
                    var step = _terminal.data('commandStep');
                    if(step < _terminal.data('commandHistory').length){
                        step++;
                        if(step == _terminal.data('commandHistory').length){
                            terminal.setInput(_terminal, '');
                        } else {
                            terminal.setInput(_terminal,
                                    _terminal.data('commandHistory')[step]);
                        }
                        _terminal.data('commandStep', step);
                    }
                    break;
                case 35: // END
                    evt.preventDefault();
                    if(_caret.hasClass('end')){return;}
                    _caret.prev().text(textBefore+_caret.text()+textAfter);
                    _caret.addClass('end');
                    _caret.text(' ');
                    _caret.next().text('');
                    _caret.removeClass('term-blink');
                    setTimeout(function(){_caret.addClass('term-blink')}, 1000);
                    break;
                case 36: // HOME
                    evt.preventDefault();
                    var firstChar = textBefore.slice(0,1);
                    if(firstChar == ''){return;}
                    if(_caret.hasClass('end'))
                    {
                        _caret.text('');
                        _caret.removeClass('end');
                    }
                    _caret.next().text(textBefore.slice(1)
                                      + _caret.text()
                                      + textAfter);
                    _caret.text(firstChar);
                    _caret.prev().text('');
                    _caret.removeClass('term-blink');
                    setTimeout(function(){_caret.addClass('term-blink')}, 1000);
                    break;
                case 13: // ENTER
                    evt.preventDefault();
                    var textWhole = (textBefore+_caret.text()+textAfter).trim();
                    _caret.parent().before('<p><span class="prompt">'
                                          +_terminal.data('options').prompt
                                          +'</span>'+textWhole+'</p>');
                    // new empty line
                    _caret.prev().text('');
                    _caret.next().text('');
                    _caret.text(' ');
                    _caret.addClass('end');

                    if(textWhole != ''){
                        var commandCount = _terminal.data(
                                                    'commandHistory').length;

                        if(textWhole !=
                        _terminal.data('commandHistory')[commandCount-1])
                        {
                            // limit the size of the command history
                            if(commandCount >= _terminal.data('options')
                                .historySize){
                                _terminal.data('commandHistory').shift();
                            }
                            _terminal.data('commandHistory').push(textWhole);
                        }
                        _terminal.data('commandStep',
                                    _terminal.data('commandHistory').length);

                        // process command
                        _terminal.data('options').processCommand(
                            textWhole, _terminal);
                    }
                    _prompt.text(_terminal.data('options').prompt);
                    _terminal.scrollTop(_terminal.prop("scrollHeight"));
                    break;
                default:
                    break;
            }
        }

        // --- bind handlers ---------------------------------------------------
        _terminal.click(onclick);
        // _hiddenInput.keypress(keypress);
        _hiddenInput.keydown(keydown);
        _hiddenInput.on('input', onchange);

        var elemID = element.attr("id");

        // insert elements
        element.before(_terminal);
        element.remove();
        _terminal.attr("id", elemID);
        // set focus
        _hiddenInput.focus();
        // return the terminal object
        return _terminal;
    },

    // set the text which is typed within the current line
    setInput : function(_terminal, text){
        text = text.replace("\n", " ");
        var _caret = $(_terminal).data('caret');
        var _prev = _caret.prev();
        var _next = _caret.next();

        _prev.text(text);
        _caret.text(' ');
        _next.text('');
        _caret.addClass('end');
    },


    // fires a command in the terminal
    // (as if the user had typed it and hit enter)
    fireCommand : function(_terminal, command){
        // copy the command into the text input
        this.setInput(_terminal, command);
        // create an enter key event and send it to the input element
        var evt = $.Event("keydown");
        evt.keyCode = 13;
        $(_terminal).find(".hiddenInput").trigger(evt);
    },

    // clear the terminal
    clear : function(_terminal){
        $(_terminal).find('p').remove();
    },

    // print text to the terminal
    print : function(_terminal, text, escapeHtml){
        if(escapeHtml === undefined){
            escapeHtml = true;
        }
        var _currentLine = _terminal.data('currentLine');
        if(escapeHtml){
            text = text.replace(/&/g, "&amp;");
            text = text.replace(/</g, "&lt;");
            text = text.replace(/>/g, "&gt;");
        }
        text = this._processColors(""+text);

        var outputElement = _currentLine.prev();
        if(outputElement.hasClass("output")){
            outputElement.append(text);
        }
        else{            
            _currentLine.before('<p class="output">'+text+'</p>');
        }
        _terminal.scrollTop(_terminal.prop("scrollHeight"));
    },

    // print text to the terminal (with line ending)
    println : function(_terminal, text, escapeHtml){
        this.print(_terminal, text+"\n", escapeHtml);
    },

    _processColors : function(text){
        var tagCount = 0;
        // text = text.replace("\x1B[31m", "<span style=\"color: red;\">");
        // text = text.replace("\x1B[0m", "</span>");

        var i = text.indexOf("\x1B[");
        while(i >= 0){
            var tag = ""
            // add a new command or reset font?
            if(text.substr(i,4) == "\x1B[0m"){ // reset
                colorCode = "\x1B[0m";
                tag = "</span>".repeat(tagCount);
                tagCount = 0;
            }
            else {
                tagCount += 1;
                colorCode = text.substr(i,5);
                if(colorCode.charAt(3) == 'm'){
                    colorCode = colorCode.substr(0,4);
                }
                tag = this._getColorTag(colorCode);
            }
            // replace the code by the new tag
            text = text.substr(0, i) + tag + text.substr(i+colorCode.length);

            i = text.indexOf("\x1B[");
        }
        if(tagCount > 0){
            text += "</span>".repeat(tagCount);
        }
        return text;
    },

    _getColorTag : function(colorCode){
        var textstyle = "";
        switch(colorCode){
            case "\x1B[31m":
                textstyle = "color: red;"
                break;
            case "\x1B[32m":
                textstyle = "color: green;"
                break;
            case "\x1B[33m":
                textstyle = "color: yellow;"
                break;
            case "\x1B[34m":
                textstyle = "color: blue;"
                break;
            case "\x1B[35m":
                textstyle = "color: magenta;"
                break;
            case "\x1B[36m":
                textstyle = "color: cyan;"
                break;
            case "\x1B[37m":
                textstyle = "color: white;"
                break;
            case "\x1B[41m":
                textstyle = "background-color: red;"
                break;
            case "\x1B[42m":
                textstyle = "background-color: green;"
                break;
            case "\x1B[43m":
                textstyle = "background-color: yellow;"
                break;
            case "\x1B[44m":
                textstyle = "background-color: blue;"
                break;
            case "\x1B[45m":
                textstyle = "background-color: magenta;"
                break;
            case "\x1B[46m":
                textstyle = "background-color: cyan;"
                break;
            case "\x1B[47m":
                textstyle = "background-color: white;"
                break;
            case "\x1B[1m":
                textstyle = "font-weight: bold;"
                break;
            case "\x1B[3m":
                textstyle = "font-style: italic;"
                break;
            case "\x1B[4m":
                textstyle = "text-decoration: underline;"
                break;
            case "\x1B[5m":
                return "<span class=\"term-textblink\">";
            case "\x1B[7m":
                return "<span class=\"term-textinverted\">";
            case "\x1B[92m": // success
                textstyle = "color: #00EE00;"
                break;
            case "\x1B[95m": // header
                textstyle = "color: #660099;"
                break;
            case "\x1B[94m": // info
                textstyle = "color: #3399FF;"
                break;
            case "\x1B[93m": // warning
                textstyle = "color: #FF9900;"
                break;
            case "\x1B[91m": // error
                textstyle = "color: #990000;"
                break;
            default:
                console.log(colorCode);
        }
        return "<span style=\""+textstyle+"\">";
    },

    // hides the caret and disables user input
    disableInput : function(_terminal){
        _terminal.data('currentLine').hide();
    },

    // hides the caret and disables user input
    enableInput : function(_terminal){
        _terminal.data('currentLine').show();
    },

    // scrolls down to the last line of the terminal
    scrollDown : function(_terminal){
        _terminal.scrollTop(_terminal.prop("scrollHeight"));
    },

    // set the options of the terminal to default
    setOptionsDefault : function(_terminal){
        var options = {};

        // process options
        options.prompt = '> ';
        options.historySize = 100;
        options.processCommand = function(cmd){
            console.log(cmd);
        }
        terminal.setOptions(_terminal, options);
    },

    // set the options of the terminal
    setOptions : function(_terminal, options){
        if(options == undefined)
        {
            options = {};
        }
        
        if(options.prompt != undefined){
            _terminal.data('options').prompt = options.prompt;
        }

        if(options.historySize != undefined){
            oldHistorySize = _terminal.data('options').historySize;
            _terminal.data('options').historySize = options.historySize;

            if(oldHistorySize > options.historySize){
                if(_terminal.data('commandHistory').length 
                    > options.historySize)
                {
                    _terminal.data('commandHistory',
                        _terminal.data('commandHistory').slice(
                            _terminal.data('commandHistory').length
                            -options.historySize));
                    _terminal.data('commandStep', options.historySize);
                }
            }
        }

        if(options.processCommand != undefined){
            _terminal.data('options').processCommand = options.processCommand;
        }
    }
};