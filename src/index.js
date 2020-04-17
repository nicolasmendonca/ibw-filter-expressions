const QUERY_TRANSFORMERS = {
  DEFAULT: ({ query }) => query,
  STRING_CONTAINS: ({ query }) => `[.*${query}.*]`,
  STRING_STARTSWITH: ({ query }) => `[^${query}.*]`,
  STRING_ENDSWITH: ({ query }) => `[.*${query}$]`
};

const QUERY_PARSERS = {
  DEFAULT: (filter, { query }) => query,
  STRING_CONTAINS: (filter, { query }) =>
    query.replace("[.*", "").replace(".*]", ""),
  STRING_STARTSWITH: (filter, { query }) =>
    query.replace("[^", "").replace(".*]", ""),
  STRING_ENDSWITH: (filter, { query }) =>
    query.replace("[.*", "").replace("$]", "")
};

const FUNCTION_PARSERS = {
  DEFAULT: ({ mathExpression }) => mathExpression,
  STRING_CONTAINS: () => "MATCHES",
  STRING_STARTSWITH: () => "MATCHES",
  STRING_ENDSWITH: () => "MATCHES"
};

const FUNCTION_TRANSFORMERS = {
  DEFAULT: ({ mathExpression }) => mathExpression,
  STRING_CONTAINS: () => "MATCHES",
  STRING_STARTSWITH: () => "MATCHES",
  STRING_ENDSWITH: () => "MATCHES"
};

const defaultParsersAndTransformers = {
  queryTransformer: QUERY_TRANSFORMERS.DEFAULT,
  queryParser: QUERY_PARSERS.DEFAULT,
  functionParser: FUNCTION_PARSERS.DEFAULT,
  functionTransformer: FUNCTION_TRANSFORMERS.DEFAULT
};

export const functionsToMathComparisonsMap = [
  ["LTE", "Less than or equal to", defaultParsersAndTransformers],
  ["LT", "Less than", defaultParsersAndTransformers],
  ["GT", "Greater than", defaultParsersAndTransformers],
  ["GTE", "Greater than or equal to", defaultParsersAndTransformers],
  ["EQ", "Is equal to", defaultParsersAndTransformers],
  ["NE", "Is not equal to", defaultParsersAndTransformers],
  ["MATCH", "Matches", defaultParsersAndTransformers],
  [
    "STRING_CONTAINS",
    "Text contains",
    {
      queryTransformer: QUERY_TRANSFORMERS.STRING_CONTAINS,
      queryParser: QUERY_PARSERS.STRING_CONTAINS,
      functionParser: FUNCTION_PARSERS.STRING_CONTAINS,
      functionTransformer: FUNCTION_TRANSFORMERS.STRING_CONTAINS
    }
  ],
  [
    "STRING_NOTCONTAINS",
    "Text does not contain",
    defaultParsersAndTransformers
  ],
  [
    "STRING_STARTSWITH",
    "Text starts with",
    {
      queryTransformer: QUERY_TRANSFORMERS.STRING_STARTSWITH,
      queryParser: QUERY_PARSERS.STRING_STARTSWITH,
      functionParser: FUNCTION_PARSERS.STRING_STARTSWITH,
      functionTransformer: FUNCTION_TRANSFORMERS.STRING_STARTSWITH
    }
  ],
  [
    "STRING_ENDSWITH",
    "Text ends with",
    {
      queryTransformer: QUERY_TRANSFORMERS.STRING_ENDSWITH,
      queryParser: QUERY_PARSERS.STRING_ENDSWITH,
      functionParser: FUNCTION_PARSERS.STRING_ENDSWITH,
      functionTransformer: FUNCTION_TRANSFORMERS.STRING_ENDSWITH
    }
  ],
  ["STRING_EQUALS", "Text is exactly", defaultParsersAndTransformers],
  [
    "STRING_LENGTH_LT",
    "Text length is less than",
    defaultParsersAndTransformers
  ],
  [
    "STRING_LENGTH_GT",
    "Text length is greater than",
    defaultParsersAndTransformers
  ]
];

const functionsToMathExpObject = functionsToMathComparisonsMap.reduce(
  (map, [comparatorFunc, mathExpression, parsersAndTransformers]) =>
    map.set(comparatorFunc, {
      comparatorFunc,
      mathExpression,
      parsersAndTransformers
    }),
  new Map()
);

const mathExpToFunctionsObject = functionsToMathComparisonsMap.reduce(
  (map, [comparatorFunc, mathExpression, parsersAndTransformers]) =>
    map.set(mathExpression, {
      comparatorFunc,
      mathExpression,
      parsersAndTransformers
    }),
  new Map()
);

/**
 * @param {string} filter
 * @returns {null|string}
 **/
export const getFilterInclusionType = filter => {
  const match = /\s(AND|OR)\s/.exec(filter);

  return match && match[1];
};

/**
 * @param {string} comparator
 * @returns {string}
 */
export const convertComparatorFuncToMathExpression = comparator =>
  functionsToMathExpObject.get(comparator).mathExpression;

/**
 * @param {string} mathExpr
 * @returns {string}
 */
export const convertMathExpressionToComparatorFunc = mathExpr =>
  mathExpToFunctionsObject.get(mathExpr).comparatorFunc;

const getLocalFunctionForStringOperator = query => {
  if (/\[\.\*.*\.\*\]/.test(query)) return "STRING_CONTAINS";
  if (/\[\^.*\.\*\]/.test(query)) return "STRING_STARTSWITH";
  if (/\[.*\$\]/.test(query)) return "STRING_ENDSWITH";
  return "MATCH";
};

const getParsedFilterForStringOperator = query =>
  functionsToMathExpObject.get(getLocalFunctionForStringOperator(query));

/**
 * This function is for internal use only. It's only exported for testing purposes.
 * @param {string} filter
 */
export const parseFilter = filter => {
  let option = "";
  let field = "";
  let query = "";

  const match = /([\w]+)\((\[\w+\]),\s(.+)\)/.exec(filter);
  /*----------  / option|  field  | query  /  -----------*/

  if (!match) return null;

  [, option, field, query] = match;

  if (option === "MATCHES") {
    // override depending on regex to find client-side implementation of string operators
    option = getParsedFilterForStringOperator(query).comparatorFunc;
  }

  const parsedFilter = functionsToMathExpObject.get(option);

  return {
    option: parsedFilter.mathExpression,
    field,
    query: parsedFilter.parsersAndTransformers.queryParser(parsedFilter, {
      query
    })
  };
};

/** @param {string} filter */
const removeElvisOperator = filter =>
  filter.substr(1).replace(") ?: false", "");

/** @param {string} filterString */
const wrapWithElvisOperator = filterString => `(${filterString}) ?: false`;

/** @param {string} filter */
const checkForAbsentFieldNamesInclusion = filter => filter.includes("IS_NULL");

/**
 * @param {string} text
 * @param {number} initialParenthesisPosition
 */
const getTextInsideParenthesis = (text, initialParenthesisPosition = 0) => {
  let parenthesisToIgnore = 0;
  let endParenthesisPositionIndex = 0;
  for (
    let characterIndex = initialParenthesisPosition;
    characterIndex <= text.length;
    characterIndex++
  ) {
    switch (text.charAt(characterIndex)) {
      case "(":
        parenthesisToIgnore++;
        break;
      case ")":
        parenthesisToIgnore--;
        break;
      default:
        break;
    }

    if (parenthesisToIgnore === 0) {
      endParenthesisPositionIndex = characterIndex;
      break;
    }
  }

  return text.substr(
    initialParenthesisPosition + 1,
    endParenthesisPositionIndex - initialParenthesisPosition - 1
  );
};

/**
 * @param {string} filterString
 * @returns {string}
 */
const stripNullChecksFromFilter = filterString => {
  const [, trimmedFilter] = filterString.trim().split(" OR ");

  return getTextInsideParenthesis(trimmedFilter);
};

const wrapFilterWithNullChecks = (filterString, filters) => {
  const nullChecks = filters
    .map(filter => `IS_NULL(${filter.field})`)
    .join(" AND ");

  return `(${nullChecks}) OR (${filterString})`;
};

/** @param {string} filterBy */
export const mapFiltersFromResponse = filterBy => {
  debugger;
  let filterString = filterBy || "";
  const filterIncludesAbsentFieldNames = checkForAbsentFieldNamesInclusion(
    filterString
  );

  if (filterIncludesAbsentFieldNames) {
    filterString = stripNullChecksFromFilter(filterString);
  }

  filterString = removeElvisOperator(filterString);

  const inclusionType = getFilterInclusionType(filterString) || "AND";

  return {
    inclusionType,
    includesAbsentFieldNames: filterIncludesAbsentFieldNames,
    filters: filterString
      .split(inclusionType) // splits " AND "|" OR "
      .filter(Boolean) // exclude nulls
      .map(parseFilter) // creates filter objects
  };
};

export const mapFiltersForRequest = ({
  inclusionType,
  filters,
  includesAbsentFieldNames
}) => {
  let filterString = filters
    .map(({ option, field, query }) => {
      const filter = mathExpToFunctionsObject.get(option);
      const comparatorFunc = filter.comparatorFunc.includes("STRING_")
        ? "MATCHES"
        : filter.comparatorFunc;

      return `${comparatorFunc}(${field}, ${filter.parsersAndTransformers.queryTransformer(
        { query }
      )})`;
    })
    .join(` ${inclusionType} `); // spaces are important

  if (!filterString) return null; // API expects null instead of an empty string

  filterString = wrapWithElvisOperator(filterString);

  return includesAbsentFieldNames
    ? wrapFilterWithNullChecks(filterString, filters)
    : filterString;
};
