/**
 * Adds an annotation to an event.
 *
 * @param event the event
 * @param ann the opaque string code for the annotation to add, or the annotation object itself
 */
exports.annotateEvent = function(event, ann) {
  if (event.annotations == null) {
    event.annotations = [];
  }

  var annotation = typeof(ann) === 'string' ? { code: ann } : ann;
  if (! exports.isAnnotated(event, annotation)) {
    event.annotations.push(annotation);
  }

  return event;
};

/**
 * Checks if an event is annotated with the specific annotation
 *
 * @param event
 * @param ann the opaque string code for the annotation to add, or the annotation object itself
 */
exports.isAnnotated = function (event, ann) {
  if (event == null || event.annotations == null || event.annotations.length === 0) {
    return false;
  }

  var annotation = typeof(ann) === 'string' ? { code: ann } : ann;
  for (var i = 0; i < event.annotations.length; ++i) {
    if (event.annotations[i].code === annotation.code) {
      return true;
    }
  }
  return false;
};
