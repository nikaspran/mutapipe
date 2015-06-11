'use strict';
var combine = require('stream-combiner'),
  R = require('ramda');

function validateStep(steps, newStep) {
  if (R.any(R.propEq('id', newStep.id))(steps)) {
    throw new Error('Id ' + newStep.id + ' already exists in ' + steps);
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

module.exports = function mutapipe() {
  var createPipeline = function (steps, stepId) {
    var build = function build() {
      return combine.apply(null, steps.map(function (step) {
        step.args = !step.buildArgs ? step.args : step.buildArgs.map(function (arg) {
          return arg();
        });
        return step.task.apply(null, step.args);
      }));
    };

    function buildStep(step) {
      var result = {
        id: step.id || stepId,
        task: step.task || step,
        args: step.args || Array.prototype.slice.call(arguments, 1),
        buildArgs: step.buildArgs
      };
      validateStep(steps, result);
      return result;
    }

    function firstStepThatMatches(selector) {
      if (typeof(selector) === 'function') {
        selector = build.get(selector);
      }
      return Array.isArray(selector) ? selector[0] : selector;
    }

    build._steps = function () {
      return steps.slice(0);
    };

    build.insert = function insert(step) {
      var fullArguments = arguments;
      return {
        after: function (afterThis) {
          afterThis = firstStepThatMatches(afterThis);
          var before = steps.slice(0, steps.indexOf(afterThis) + 1);
          var middle = step._steps ? step._steps() : [buildStep.apply(null, fullArguments)];
          var after = steps.slice(steps.indexOf(afterThis) + 1);
          return createPipeline(before.concat(middle).concat(after), stepId + 1);
        }
      };
    };

    build.without = function without(step) {
      step = firstStepThatMatches(step);
      var withoutReplaced = steps.slice(0);
      withoutReplaced.splice(steps.indexOf(step), 1);
      return createPipeline(withoutReplaced, stepId + 1);
    };

    build.appendStepsTo = function appendStepsTo(otherSteps) {
      return otherSteps.concat(steps);
    };

    build.get = function get(matcher) {
      return steps.filter(matcher);
    };

    build.replace = function replace(step) {
      step = firstStepThatMatches(step);
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
    return R.propEq('task', task);
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
