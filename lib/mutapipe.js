'use strict';
var R = require('ramda');
var combine = require('stream-combiner');

function validateStep(steps, newStep) {
  if (R.any(R.propEq('id', newStep.id))(steps)) {
    throw new Error('Id ' + newStep.id + ' already exists in \n' + steps.map(JSON.stringify).join('\n'));
  }
}

function startsWith(shorter, longer) {
  for (var i = 0; i < shorter.length; i++) {
    if (shorter[i] !== longer[i]) {
      return false;
    }
  }
  return true;
}

function isFunction(fn) {
  return typeof(fn) === 'function';
}

function prefixIds(steps, prefix) {
  steps.forEach(function (step) {
    step.id = prefix + '_' + step.id;
  });
  return steps;
}

function firstStepThatMatches(builder, selector) {
  if (isFunction(selector)) {
    selector = builder.first(selector);
  }
  return Array.isArray(selector) ? selector[0] : selector;
}

function ArgBuilder(arg) {
  this.build = arg;
}

function PreviousResult(selector, method) {
  var self = this;
  this.forPipeline = {};
  this.task = function () {
    var result = firstStepThatMatches(self.forPipeline, selector)._result; //TODO: validate it's a function
    return result[method].apply(result, arguments);
  };
}

module.exports = function mutapipe() {
  var createPipeline = function (steps, stepId) {
    var build = function build() {
      //TODO: validate
      return combine.apply(null, steps.map(function (step) {
        step.args = step.args.map(function (arg) {
          return arg instanceof ArgBuilder ? arg.build() : arg;
        });
        return (step._result = isFunction(step.task) ? step.task.apply(null, step.args) : step.task);
      }));
    };

    function buildStep(step) {
      if (step instanceof PreviousResult) {
        step.forPipeline = build;
      }

      var result = {
        id: step.id || stepId,
        task: step.task || step,
        args: step.args || Array.prototype.slice.call(arguments, 1)
      };
      validateStep(steps, result);
      return result;
    }

    build._steps = function () {
      return steps.slice(0);
    };

    build.insert = function insert(step) {
      var fullArguments = arguments;
      return {
        after: function (afterThis) {
          afterThis = firstStepThatMatches(build, afterThis);
          var before = steps.slice(0, steps.indexOf(afterThis) + 1);
          var middle = step._steps ? prefixIds(step._steps(), stepId) : [buildStep.apply(null, fullArguments)];
          var after = steps.slice(steps.indexOf(afterThis) + 1);
          return createPipeline(before.concat(middle).concat(after), stepId + 1);
        }
      };
    };

    build.without = function without(step) {
      step = firstStepThatMatches(build, step);
      var withoutReplaced = steps.slice(0);
      withoutReplaced.splice(steps.indexOf(step), 1);
      return createPipeline(withoutReplaced, stepId + 1);
    };

    build.appendStepsTo = function appendStepsTo(otherSteps) {
      return otherSteps.concat(steps);
    };

    build.filter = function filter(matcher) {
      return steps.filter(matcher);
    };

    build.first = function first(matcher) {
      return (matcher ? build.filter(matcher) : steps)[0];
    };

    build.replace = function replace(step) {
      step = firstStepThatMatches(build, step);
      return {
        with: function () {
          var stepBefore = steps[steps.indexOf(step) - 1];
          var newPipeline = build.without(step);
          return newPipeline.insert.apply(newPipeline, arguments).after(stepBefore);
        }
      };
    };

    build.pipe = function pipe(step) {
      return build.insert.apply(build, arguments).after(steps[steps.length - 1]);
    };

    return build;
  };

  return createPipeline([], 0);
};

module.exports.by = {
  task: function byTask(task) {
    return R.pipe(R.prop('task'), R.identical(task));
  },
  args: function byArgs() {
    return R.pipe(R.prop('args'), R.partial(startsWith, arguments));
  },
  id: function byId(id) {
    return R.propEq('id', id);
  },
  all: function byAll() {
    return R.allPass(arguments);
  }
};

module.exports.build = function argBuilder(arg) {
  return new ArgBuilder(arg);
};

module.exports.previous = function previous(selector, method) {
  return new PreviousResult(selector, method);
};
