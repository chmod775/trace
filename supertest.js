let testClass_Handler = {
  get: function(target, prop, receiver) {
  },
  set: function(target, prop, receiver) {
  }
}
let testClass = new Proxy({}, testClass_Handler);


class abc extends testClass {
  
}