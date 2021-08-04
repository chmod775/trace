const fs = require('fs');
const path = require('path');

class Helpers {
	constructor(){}
	static UniqueID(prefix, cnt) {
		prefix = prefix ?? '_';
		return prefix + cnt;
	}

  static IsNumber(text) {
    return !isNaN(text);
  }

	static ObjectMatch(obj, objCompare) {
		for (var k in objCompare) {
			let v = objCompare[k];
			let myV = obj[k];
	
			var ret = false;
			if (myV !== Object(myV))
				ret = (v == myV);
			else
				ret = Helpers.ObjectMatch(myV, v);
			if (!ret) return false;
		}
		return true;
	}

	static JSSafe(name, prefix) {
		prefix = prefix ?? '$';
		let safeName = name.replace(/[^\w\d\$\_]/g, '_');
		if (safeName.match(/^\d/))
			safeName = prefix + safeName;
		return safeName;
	}

	static SplitLine(line) {
		let parts = line.trim().split(' ');
		// remove empty parts
		parts = parts.filter(p => p.length > 0);
		// join literal parts
		let finalParts = [];
		do {
			let p = parts.shift();
			if (!p) break;
			if (p.split('"').length == 2) {
				let joinedParts = [];
				joinedParts.push(p);

				do {
					let pp = parts.shift();
					joinedParts.push(pp);
					if (pp.split('"').length == 2) break;
				} while (parts.length > 0);

				finalParts.push(joinedParts.join(' '));
			} else
				finalParts.push(p);
		} while (parts.length > 0);

		return finalParts;
	}

	static ArgsToObject(args, fields) {
		let ret = {};
		for (var fIdx in fields) {
			var fVal = fields[fIdx];
			var aVal = args[fIdx];

			switch (fVal.type.toLowerCase()) {
				case 'number':
					aVal = +aVal;
					break;
			}

			ret[fVal.name] = aVal ?? fVal.default;
		}
		return ret;
	}

  static ScanDir(startPath, filter, ret) {
    ret = ret ?? [];
    if (!fs.existsSync(startPath)) throw 'No directory';

    var files = fs.readdirSync(startPath);
    for(var f of files){
      var filepath = path.join(startPath, f);
      var stat = fs.lstatSync(filepath);
      if (stat.isDirectory()) {
        Helpers.ScanDir(filepath, filter, ret);
      }
      else if (filepath.indexOf(filter) >= 0) {
        let extension = path.extname(filepath);
        let file = path.basename(filepath, extension);
        ret.push({
          path: filepath,
          filename: file,
          extension: extension
        })
      };
    };

    return ret;
  };
}

module.exports = Helpers;