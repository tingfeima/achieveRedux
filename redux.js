

/**
 * reducer,preloadedState,enhancer
 * return {getState,dispatch,subscribe}
*/
function createStore(reducer, preloadedState, enhancer) {
  if (typeof reducer !== 'function') { throw new Error('reducer need function') }

  if (typeof enhancer !== 'undefined') {
    // 是否传递 第三个参数
    if (typeof enhancer !== 'function') {
      // 第三个参数 是否是函数
      throw new Error('enhancer must function')
    }
    /**
     * 传递了 enhancer,对 store 进行增强，直接 return 后面的终止执行
     * enhancer 再返回一个函数用来接受 reducer, preloadedState 参数，返回一个更加强大的 store 对象
     * 
     * */
    return enhancer(createStore)(reducer, preloadedState)
  }

  // store 对象中存储的状态
  var currentSate = preloadedState
  // 保存订阅者函数
  var currentListeners = []
  // 获取状态
  function getState() {
    return currentSate
  }

  // 触发 action
  function dispatch(action) {
    /**
     * action 必须是对象
     * 必须具有 type 属性
     * 
    */
    if (!isPlainObject(action)) { throw new Error('action need object') }
    if (typeof action.type === 'undefined') { throw new Error('action must type field') }

    // 调用 reducer 函数，处理状态，返回新的状态
    currentSate = reducer(currentSate, action)

    // 调用订阅者，通知订阅者状态发生了改变
    for (var i = 0; i < currentListeners.length; i++) {
      var listener = currentListeners[i]
      listener()
    }
  }
  // 订阅状态
  function subscribe(listener) {
    currentListeners.push(listener)
  }
  return {
    getState,
    dispatch,
    subscribe,
  }
}


function isPlainObject(obj) {
  // 判断是否是对象
  if (typeof obj !== 'object' || obj === null) { return false }
  // 判断是[] / {}
  var proto = obj
  while (Object.getPrototypeOf(proto) != null) {
    proto = Object.getPrototypeOf(proto)
  }
  return Object.getPrototypeOf(obj) === proto
}

// 简化 action 的编码方式、调用方式
function bindActionCreators(actionCreators, dispatch) {
  /**
   * 参数一：function 元素的{}
   * 参数二：dispatch
   * */
  var boundActionCreators = {}
  for (var key in actionCreators) {
    // 使用 闭包来缓存当前 key;而不是循环结束后的最后一个key 值
    (function (key) {
      boundActionCreators[key] = function () {
        dispatch(actionCreators[key]())
      }
    })(key)
  }
  return boundActionCreators
}

// 合并多个子的 reducer
function combineReducers(reducers) {
  //1. 检查每个 reducer 必须是function

  var reducerKeys = Object.keys(reducers)
  for (var i = 0; i < reducerKeys.length; i++) {
    var key = reducerKeys[i]
    if (typeof reducers[key] !== 'function') { throw new Error('reducer must function') }
  }

  //2. 调用每个小的 reducer 将每个小的 reducer 中返回的状态存储在一个新的大的对象中
  return function (state, action) {
    var nextState = {}
    for (var i = 0; i < reducerKeys.length; i++) {
      var key = reducerKeys[i]
      var reducer = reducers[key]
      var preciousStateByKey = state[key] // 得到 子项 的state
      nextState[key] = reducer(preciousStateByKey, action)
    }
    return nextState
  }
}

/**
 * applyMiddleware 是一个 内置的 enhancer 方法，是对 store 的一个增强
 * 中间件 action后 先经过中间件处理后 （本质是对 dispatch 的增强），最后再执行 redux 中的 reducer；
 * 每一个中间件 是一个 function ,返回一个 function ,在返回的 function 中再返回个 function ; -> middlewares/logger.js
 * function logger(store) { // store 是阉割版的store {getState,dispatch} 即可
      return function (next) { // next 是下一个中间件，最里层的一个 function; 最后一个中间件的 next 就是 redux 中 dispatch ,dispatch 中调用了 reducer(currentState,action)
        return function (action) {
          console.log('logger :>> ', action);
          next()
        }
      }
    }
 * 外面两层的 function 是为了接受参数，本质执行的是最里层的一个 function
 * */
function applyMiddleware(...middlewares) {
  return function (createStore) {
    return function (reducer, preloadedState) {
      // 1. 创建 store
      var store = createStore(reducer, preloadedState)
      // 2. 阉割版 store
      var middlewareStore = {
        getState: store.getState,
        dispatch: store.dispatch
      }
      // 3. 调用中间件的第一层function 传递阉割版的store对象
      var chain = middlewares.map(middleware => middleware(middlewareStore))
      // chain 中保存的中间建返回的 第二层 function
      // 4. 传递 第二次 function 参数 next
      var dispatch = compose(...chain)(store.dispatch) // compose() 调用返回的function 中传递 redux 的dispatch
      // compose 返回的 dispatch 就是 logger 最里层的 function 
      return {
        ...store,
        dispatch
      }
    }
  }
}

function compose() {
  var args = [...arguments]
  return function (dispatch) {
    // 倒序调用中间件中的第二层函数；因为 next 参数是 上一个中间件二层函数返回的function dispatch(redux)->thunk->logger
    for (var i = args.length - 1; i >= 0; i--) {
      /**
       * i=1,args[i] 是 thunk 二层函数，dispatch是 redux 的 dispatch
       * i=0,args[i] 是 logger 二层函数，dispatch是 thunk 的 最里层函数
       * 循环结束之后，dispatch 是 logger 的最里层函数，再将 dispatch 返回；中间件在执行时 logger->thunk->dispatch(redux)
      */
      dispatch = args[i](dispatch)
    }
    return dispatch

  }
}