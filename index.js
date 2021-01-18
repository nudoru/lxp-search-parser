/* eslint-disable no-plusplus */
const csv = require('csvtojson');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const isBetween = require('dayjs/plugin/isBetween');

const report = './search-report.csv';
const startDate = dayjs('2020-12-01');
const endDate = dayjs('2020-12-31');

dayjs.extend(customParseFormat);
dayjs.extend(isBetween);

const hasSearchTerm = (row) => row.field4.length > 1;
const isDateRange = (row) =>
  dayjs(row.field2, 'YYYY-MM-DD H:mm:ss').isBetween(startDate, endDate);

const removeHeaderRow = (row) =>
  Object.keys(row).reduce((acc, key, i) => {
    if (i > 0) {
      acc[key] = row[key];
    }
    return acc;
  }, {});

let errorCount = 0;

const formatRow = ({ field1, field2, field3, field4, field5, ...rest }) => {
  let filtersObj;
  const filtersStr = Object.keys(rest)
    .reduce((acc, key) => {
      const rawValue = rest[key];
      let value = rawValue;

      // CSV strips quotes out of JSON filters list
      if (rawValue.indexOf('"') < 0) {
        // plain value
        value = `"${rawValue}"`;
      } else if (
        !(rawValue.indexOf('[') === 0 || rawValue.indexOf('{') === 0) &&
        rawValue.indexOf('"') > 0 &&
        rawValue.indexOf('"') != 0 &&
        rawValue.lastIndexOf('"') != rawValue.length - 1
      ) {
        // contains a quote but doesn't start or end with one and doesn't start with a bracket
        value = `"${rawValue}"`;
      }
      acc.push(value);
      return acc;
    }, [])
    .join(',');

  try {
    filtersObj = JSON.parse(filtersStr);
  } catch (e) {
    console.warn('Bad JSON format', filtersStr, rest);
    errorCount++;
  }

  return {
    dateStr: field2,
    // Not needed, date: dayjs(field2, 'YYYY-MM-DD H:mm:ss'),
    term: field4,
    results: field5,
    filters: filtersObj,
    filtersStr,
  };
};

// https://medium.com/@gmcharmy/sort-objects-in-javascript-e-c-how-to-get-sorted-values-from-an-object-142a9ae7157c
// {key1:countVal, key2: countVal, key3: countVal, ...}
// Alphabetical sort by countVal and take the top #
const sortObjectEntries = (obj, top) =>
  Object.entries(obj)
    .sort((a, b) => {
      if (b[1] > a[1]) return 1;
      if (b[1] < a[1]) return -1;
      if (a[0] > b[0]) return 1;
      if (a[0] < b[0]) return -1;
      return 0;
    })
    .map((el) => el[0])
    .slice(0, top);

const processData = (json) => {
  console.log('imported', json.length);
  const filteredSet = json
    .filter(isDateRange)
    .filter(hasSearchTerm)
    .map(removeHeaderRow)
    .map(formatRow);
  console.log('found', filteredSet.length);
  console.log('errors', errorCount);
  console.log('\n----------\n');
  return filteredSet;
};

const groupBySearches = (filteredSet) => {
  const groupSet = {};
  filteredSet.forEach((row) => {
    if (groupSet.hasOwnProperty(row.term)) {
      groupSet[row.term]++;
    } else {
      groupSet[row.term] = 1;
    }
  });
  sortObjectEntries(groupSet, 25).forEach((term) => {
    console.log(`${term}\t${groupSet[term]}`);
  });
  return groupSet;
};

// TODO - group by users
// TODO - show common filters

csv()
  .fromFile(report)
  .then((json) => groupBySearches(processData(json)));
