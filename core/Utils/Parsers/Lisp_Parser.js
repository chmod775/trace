const Helpers = require("../Helpers");

class Lisp_Statement {
  constructor(keyword, args) {
    if (!keyword || (keyword.length < 1)) throw 'Invalid keyword';
    this.keyword = keyword.toLowerCase();
    this.args = args ?? [];
  }

  SetArgument(arg) {
    let statementArgs = this.args.filter(a => a instanceof Lisp_Statement);
    let foundArgIndex = statementArgs.findIndex(a => a.keyword == arg.keyword);
    if (foundArgIndex < 0)
      this.AddArgument(arg);
    else
      this.args[foundArgIndex] = arg;
  }

  AddArgument(arg) {
    this.args.push(arg);
    return arg;
  }

  toString() {
    let out = [this.keyword];
    for (var a of this.args) {
      let argContent = (a ?? '').toString();
      if (a instanceof Lisp_Statement)
        out.push(argContent);
      else {
        let containsSpaces = (argContent ?? '').includes(' ');
        if (containsSpaces) {
          if (argContent.startsWith('"')) argContent = argContent.substring(1);
          if (argContent.endsWith('"')) argContent = argContent.substring(0, argContent.length - 1);
          argContent = argContent.replace(/\"/g, "'");
          argContent = `"${argContent}"`;
        }

        out.push(argContent);
      }
    }
    return `${this.args.length > 1 ? '\n' : ''}(${out.join(' ')})`;
  }

  get length() {
    return this.args.length;
  }
}

class Lisp_Parser {
  constructor(raw) {
    this.raw = raw;
    this.cursor = 0;
  }

  GetToken() {
    var argument = '';
    do {
      let ch = this.raw[this.cursor++];
      switch (ch) {
        case '(':
          return { type: 'START' };
        case ')':
          return { type: 'END' };
        case '"':
          argument = '';
          do {
            ch = this.raw[this.cursor++];
            if (ch != '"') argument += ch;
          } while (ch != '"');
          return { type: 'STRING', content: argument };
        case ' ':
        case '\n':
        case '\r':
        case '\t':
          break;
        default:
          argument = '';
          while ((ch != ' ') && (ch != ')')) {
            argument += ch;
            ch = this.raw[this.cursor++];
          }
          this.cursor--;
          if (Helpers.IsNumber(argument)) {
            return { type: 'NUMBER', content: +argument };
          } else {
            return { type: 'KEYWORD', content: argument };
          }

      }
    } while (this.cursor < this.raw.length);
  }

  Next(type) {
    let tok = this.GetToken();
    if (tok.type != type) throw `Unexpected token, searching for ${type} found ${tok.type}`;
    return tok;
  }

  ParseStatement() {
    let parsed = [];

    let t;
    do {
      t = this.GetToken();
      if (t.type == 'START') {
        parsed.push(this.ParseStatement());
      } else if (t.type != 'END') {
        parsed.push(t.content);
      }
    } while (t.type != 'END');

    return new Lisp_Statement(parsed[0], parsed.splice(1));
  }

  Parse() {
    this.Next('START');
    return this.ParseStatement();
  }
}

module.exports.Lisp_Parser = Lisp_Parser;
module.exports.Lisp_Statement = Lisp_Statement;