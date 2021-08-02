class Logger {
  static BASH_Color_None = '\x1b[0m';
  static BASH_Color_Green = '\x1b[32m';
  static BASH_Color_Yellow = '\x1b[33m';
  static BASH_Color_Red = '\x1b[31m';
  static BASH_Color_Blue = '\x1b[34m';
  static BASH_Color_Magenta = '\x1b[35m';
  static BASH_Color_Cyan = '\x1b[36m';

  static _Log(color, message, extra, payload) {
    let out = [];

    out.push(color);
    out.push(message);
    out.push(Logger.BASH_Color_None);

    if (extra) {
      out.push(' - ');
      out.push(extra);
    }

    if (payload) {
      out.push(' -> ');
      out.push(JSON.stringify(payload));
    }

    console.log(out.join(''));
  }

  static Info(message, extra, payload) {
    Logger._Log(Logger.BASH_Color_Blue, 'INFO: ' + message, extra, payload);
  }
  static Ok(message, extra, payload) {
    Logger._Log(Logger.BASH_Color_Green, 'OK: ' + message, extra, payload);
  }
  static Warning(message, extra, payload) {
    Logger._Log(Logger.BASH_Color_Yellow, 'WARNING: ' + message, extra, payload);
  }
  static Error(message, extra, payload) {
    Logger._Log(Logger.BASH_Color_Red, 'ERROR: ' + message, extra, payload);
  }
}

module.exports = Logger;