Array.prototype.groupBy = function (predicate: Function, asArray = false) {
  let result = this.reduce(function (rv, x) {
    (rv[predicate(x)] = rv[predicate(x)] || []).push(x);
    return rv;
  }, {});

  if (asArray === true) {
    result = Object.keys(result).map((key) => {
      return {
        key: key,
        values: result[key],
      };
    });
  }

  return result;
};

Array.prototype.selectMany = function (predicate: Function) {
  const result = [];

  for (const item of this) {
    result.push(...predicate(item));
  }

  return result;
};

Array.prototype.firstOrUndefined = function (predicate: Function) {
  const result = this.filter((x) => predicate(x));

  if (result.length > 0) {
    return result[0];
  }

  return undefined;
};

Array.prototype.zip = function <TSecond, TResult>(
  second: TSecond[],
  predicate: Function,
): TResult[] {
  return this.map((element: any, index: number) =>
    predicate(element, second[index]),
  );
};

Array.prototype.remove = function <T>(element: T): number {
  const index = this.indexOf(element);
  if (index >= 0) {
    this.splice(index, 1);
  }

  return index;
};

declare interface Array<T> {
  groupBy(predicate: (item: T) => any): any;
  selectMany(predicate: (item: T) => T[]): T[];
  firstOrUndefined(predicate: (item: T) => boolean): T | undefined;
  zip<TSecond, TResult>(
    second: TSecond[],
    predicate: (first: T, second: TSecond) => TResult,
  ): TResult[];
  remove(element: T): number;
}
