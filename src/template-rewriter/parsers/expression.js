const allowedKeywords =
  'Math,Date,this,true,false,null,undefined,Infinity,NaN,' +
  'isNaN,isFinite,decodeURI,decodeURIComponent,encodeURI,' +
  'encodeURIComponent,parseInt,parseFloat'
const allowedKeywordsRE =
  new RegExp('^(' + allowedKeywords.replace(/,/g, '\\b|') + '\\b)')

// keywords that don't make sense inside expressions
const improperKeywords =
  'break,case,class,catch,const,continue,debugger,default,' +
  'delete,do,else,export,extends,finally,for,function,if,' +
  'import,in,instanceof,let,return,super,switch,throw,try,' +
  'const,while,with,yield,enum,await,implements,package,' +
  'proctected,static,interface,private,public'
const improperKeywordsRE =
  new RegExp('^(' + improperKeywords.replace(/,/g, '\\b|') + '\\b)')

const wsRE = /\s/g
const newlineRE = /\n/g
const saveRE = /[\{,]\s*[\w\$_]+\s*:|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|new |typeof |void /g
const restoreRE = /"(\d+)"/g
const pathTestRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['.*?'\]|\[".*?"\]|\[\d+\]|\[[A-Za-z_$][\w$]*\])*$/
const identRE = /[^\w$\.](?:[A-Za-z_$][\w$]*)/g
const booleanLiteralRE = /^(?:true|false)$/

/**
 * Save / Rewrite / Restore
 *
 * When rewriting paths found in an expression, it is
 * possible for the same letter sequences to be found in
 * strings and Object literal property keys. Therefore we
 * remove and store these parts in a temporary array, and
 * restore them after the path rewrite.
 */
const saved = []

/**
 * Save replacer
 *
 * The save regex can match two possible cases:
 * 1. An opening object literal
 * 2. A string
 * If matched as a plain string, we need to escape its
 * newlines, since the string needs to be preserved when
 * generating the function body.
 *
 * @param {String} str
 * @param {String} isString - str if matched as a string
 * @return {String} - placeholder with index
 */
function save (str, isString) {
  const i = saved.length
  saved[i] = isString
    ? str.replace(newlineRE, '\\n')
    : str
  return '"' + i + '"'
}

/**
 * Path rewrite replacer
 *
 * @param {String} raw
 * @return {String}
 */
function rewrite (raw) {
  const c = raw.charAt(0)
  let path = raw.slice(1)
  /* istanbul ignore if */
  if (allowedKeywordsRE.test(path)) {
    return raw
  }
  else {
    path = path.indexOf('"') > -1
      ? path.replace(restoreRE, restore)
      : path
    return c + path
  }
}

/**
 * Restore replacer
 *
 * @param {String} str
 * @param {String} i - matched save index
 * @return {String}
 */
function restore (str, i) {
  return saved[i]
}

/**
 * Rewrite an expression, prefixing all path accessors
 * and generate getter/setter functions.
 *
 * @param {String} exp
 * @return {Function}
 */
function compileGetter (exp) {
  /* istanbul ignore if */
  if (improperKeywordsRE.test(exp)) {
    console.warn('Avoid using reserved keywords in expression: ' + exp)
  }
  // reset state
  saved.length = 0
  // save strings and object literal keys
  let body = exp
    .replace(saveRE, save)
    .replace(wsRE, '')
  // rewrite all paths
  // pad 1 space here becaue the regex matches 1 extra char
  body = (' ' + body)
    .replace(identRE, rewrite)
    .replace(restoreRE, restore)
  return body.trim()
}

/**
 * Parse an expression into re-written getter.
 *
 * @param {String} exp
 * @return {String}
 */
function parseExpression (exp) {
  exp = exp.trim()
  const res = isSimplePath(exp) && exp.indexOf('[') < 0
    // optimized super simple getter
    ? '' + exp
    : compileGetter(exp)
  return res
}

/**
 * Check if an expression is a simple path.
 *
 * @param {String} exp
 * @return {Boolean}
 */
function isSimplePath (exp) {
  return pathTestRE.test(exp) &&
    // don't treat true/false as paths
    !booleanLiteralRE.test(exp) &&
    // Math constants e.g. Math.PI, Math.E etc.
    exp.slice(0, 5) !== 'Math.'
}

exports.parseExpression = parseExpression
