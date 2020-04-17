import {
  getFilterInclusionType,
  parseFilter,
  mapFiltersFromResponse,
  mapFiltersForRequest
} from "./index";

test("getFilterInclusionType", () => {
  expect(getFilterInclusionType("function AND function")).toEqual("AND");
  expect(getFilterInclusionType("function OR function")).toEqual("OR");
  expect(getFilterInclusionType("function function")).toBeNull();
});

test("parseFilter", () => {
  expect(parseFilter("GT([StartTime], 1582142365)")).toEqual({
    field: "[StartTime]",
    option: "Greater than",
    query: "1582142365"
  });

  expect(parseFilter("LTE([StartTime], 1582142365)")).toEqual({
    field: "[StartTime]",
    option: "Less than or equal to",
    query: "1582142365"
  });

  expect(parseFilter("LTE([StartTime], [EndTime])")).toEqual({
    field: "[StartTime]",
    option: "Less than or equal to",
    query: "[EndTime]"
  });

  expect(parseFilter("MATCHES([StartTime], [.*foo.*])")).toEqual({
    field: "[StartTime]",
    option: "Text contains",
    query: "foo"
  });

  expect(parseFilter("STRING_STARTSWITH([StartTime], [^foo.*])")).toEqual({
    field: "[StartTime]",
    option: "Text starts with",
    query: "foo"
  });

  expect(parseFilter("STRING_ENDSWITH([StartTime], [.*foo$])")).toEqual({
    field: "[StartTime]",
    option: "Text ends with",
    query: "foo"
  });
});

test("real world use case", () => {
  // # Parse from response

  expect(
    mapFiltersFromResponse(
      "(GT([StartTime], 1582142365) AND LT([StartTime], 1582142365)) ?: false"
    )
  ).toEqual({
    includesAbsentFieldNames: false,
    inclusionType: "AND",
    filters: [
      { field: "[StartTime]", option: "Greater than", query: "1582142365" },
      { field: "[StartTime]", option: "Less than", query: "1582142365" }
    ]
  });

  expect(
    mapFiltersFromResponse("(GT([StartTime], 1582142365)) ?: false")
  ).toEqual({
    includesAbsentFieldNames: false,
    inclusionType: "AND",
    filters: [
      { field: "[StartTime]", option: "Greater than", query: "1582142365" }
    ]
  });

  expect(mapFiltersFromResponse(null)).toEqual({
    includesAbsentFieldNames: false,
    inclusionType: "AND",
    filters: []
  });

  expect(
    mapFiltersFromResponse(
      "(IS_NULL([StartTime]) AND IS_NULL([StartTime])) OR ((GT([StartTime], 1582142365) AND LT([StartTime], 1582142365)) ?: false)"
    )
  ).toEqual({
    inclusionType: "AND",
    includesAbsentFieldNames: true,
    filters: [
      { field: "[StartTime]", option: "Greater than", query: "1582142365" },
      { field: "[StartTime]", option: "Less than", query: "1582142365" }
    ]
  });

  // # Convert back to string for API

  expect(
    mapFiltersForRequest({
      inclusionType: "AND",
      includesAbsentFieldNames: false,
      filters: [
        { field: "[StartTime]", option: "Greater than", query: "1582142365" },
        { field: "[StartTime]", option: "Less than", query: "1582142365" }
      ]
    })
  ).toEqual(
    "(GT([StartTime], 1582142365) AND LT([StartTime], 1582142365)) ?: false"
  );

  expect(
    mapFiltersForRequest({
      inclusionType: "OR",
      includesAbsentFieldNames: false,
      filters: [
        { field: "[StartTime]", option: "Greater than", query: "1582142365" }
      ]
    })
  ).toEqual("(GT([StartTime], 1582142365)) ?: false");

  expect(
    mapFiltersForRequest({
      inclusionType: "OR",
      includesAbsentFieldNames: true,
      filters: [
        { field: "[StartTime]", option: "Greater than", query: "1582142365" },
        { field: "[StartTime]", option: "Less than", query: "1582142365" }
      ]
    })
  ).toEqual(
    "(IS_NULL([StartTime]) AND IS_NULL([StartTime])) OR ((GT([StartTime], 1582142365) OR LT([StartTime], 1582142365)) ?: false)"
  );

  expect(
    mapFiltersForRequest({
      inclusionType: null,
      includesAbsentFieldNames: false,
      filters: []
    })
  ).toBeNull();
});

test("full round trip with absent field names", () => {
  const filterString =
    "(IS_NULL([StartTime]) AND IS_NULL([StartTime])) OR ((GT([StartTime], 1582142365) AND LT([StartTime], 1582142365)) ?: false)";
  const filters = {
    inclusionType: "AND",
    includesAbsentFieldNames: true,
    filters: [
      { field: "[StartTime]", option: "Greater than", query: "1582142365" },
      { field: "[StartTime]", option: "Less than", query: "1582142365" }
    ]
  };

  expect(mapFiltersFromResponse(filterString)).toEqual(filters);
  expect(mapFiltersForRequest(filters)).toEqual(filterString);
});

test("full round trip without absent field names", () => {
  const filterString =
    "(GT([StartTime], 1582142365) AND LT([StartTime], 1582142365)) ?: false";
  const filters = {
    inclusionType: "AND",
    includesAbsentFieldNames: false,
    filters: [
      { field: "[StartTime]", option: "Greater than", query: "1582142365" },
      { field: "[StartTime]", option: "Less than", query: "1582142365" }
    ]
  };

  expect(mapFiltersFromResponse(filterString)).toEqual(filters);
  expect(mapFiltersForRequest(filters)).toEqual(filterString);
});

test("full round trip without absent field names and with string functions", () => {
  const filterString1 = `(GT([StartTime], 1582142365) AND MATCHES([name], [^firstName.*])) ?: false`;
  const filters1 = {
    inclusionType: "AND",
    includesAbsentFieldNames: false,
    filters: [
      { field: "[StartTime]", option: "Greater than", query: "1582142365" },
      { field: "[name]", option: "Text starts with", query: "firstName" }
    ]
  };

  expect(mapFiltersFromResponse(filterString1)).toEqual(filters1);
  expect(mapFiltersForRequest(filters1)).toEqual(filterString1);

  const filterString2 = `(GT([StartTime], 1582142365) AND MATCHES([name], [.*firstName.*])) ?: false`;
  const filters2 = {
    inclusionType: "AND",
    includesAbsentFieldNames: false,
    filters: [
      { field: "[StartTime]", option: "Greater than", query: "1582142365" },
      { field: "[name]", option: "Text contains", query: "firstName" }
    ]
  };

  expect(mapFiltersFromResponse(filterString2)).toEqual(filters2);
  expect(mapFiltersForRequest(filters2)).toEqual(filterString2);

  const filterString3 = `(GT([StartTime], 1582142365) AND MATCHES([name], [.*firstName$])) ?: false`;
  const filters3 = {
    inclusionType: "AND",
    includesAbsentFieldNames: false,
    filters: [
      { field: "[StartTime]", option: "Greater than", query: "1582142365" },
      { field: "[name]", option: "Text ends with", query: "firstName" }
    ]
  };

  expect(mapFiltersFromResponse(filterString3)).toEqual(filters3);
  expect(mapFiltersForRequest(filters3)).toEqual(filterString3);
});

test("full round trip with absent field names and with string functions", () => {
  const filterString1 = `(IS_NULL([StartTime]) AND IS_NULL([name])) OR ((GT([StartTime], 1582142365) AND MATCHES([name], [^firstName.*])) ?: false)`;
  const filters1 = {
    inclusionType: "AND",
    includesAbsentFieldNames: true,
    filters: [
      { field: "[StartTime]", option: "Greater than", query: "1582142365" },
      { field: "[name]", option: "Text starts with", query: "firstName" }
    ]
  };

  expect(mapFiltersFromResponse(filterString1)).toEqual(filters1);
  expect(mapFiltersForRequest(filters1)).toEqual(filterString1);

  const filterString2 = `(IS_NULL([StartTime]) AND IS_NULL([name])) OR ((GT([StartTime], 1582142365) AND MATCHES([name], [.*firstName.*])) ?: false)`;
  const filters2 = {
    inclusionType: "AND",
    includesAbsentFieldNames: true,
    filters: [
      { field: "[StartTime]", option: "Greater than", query: "1582142365" },
      { field: "[name]", option: "Text contains", query: "firstName" }
    ]
  };

  expect(mapFiltersFromResponse(filterString2)).toEqual(filters2);
  expect(mapFiltersForRequest(filters2)).toEqual(filterString2);

  const filterString3 = `(IS_NULL([StartTime]) AND IS_NULL([name])) OR ((GT([StartTime], 1582142365) AND MATCHES([name], [.*firstName$])) ?: false)`;
  const filters3 = {
    inclusionType: "AND",
    includesAbsentFieldNames: true,
    filters: [
      { field: "[StartTime]", option: "Greater than", query: "1582142365" },
      { field: "[name]", option: "Text ends with", query: "firstName" }
    ]
  };

  expect(mapFiltersFromResponse(filterString3)).toEqual(filters3);
  expect(mapFiltersForRequest(filters3)).toEqual(filterString3);
});
