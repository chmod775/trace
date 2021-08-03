class test {
  static pushme(val) {
    this.arr = this.arr ?? [];
    this.arr.push(val);
  }
}

class test_a extends test {
  constructor() {
    super();
    test_a.pushme('1');
  }
}

class test_b extends test {
  constructor() {
    super();
    test_b.pushme('1');
    test_b.pushme('2');
    test_b.pushme('3');
    test_b.pushme('4');
  }
}

let a = new test_a();
let b = new test_b();

console.log(a.arr, b.arr);
console.log(test_a.arr, test_b.arr);