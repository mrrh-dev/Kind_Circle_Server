import { ObjectId } from 'mongodb';

export const EVENT_TYPES = [
  'Cleanup',
  'Plantation',
  'Donation',
  'Food Distribution',
  'Blood Donation',
  'Education',
  'Health Camp',
  'Other',
];

export function isValidObjectId(id) {
  return (
    typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) && ObjectId.isValid(id)
  );
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function eventNotFound(res) {
  return res.status(404).send({ message: 'We could not find that event.' });
}

export function validateEventInput(body = {}) {
  const errors = {};

  const clean = (value) => (typeof value === 'string' ? value.trim() : '');
  const title = clean(body.title);
  const description = clean(body.description);
  const eventType = clean(body.eventType);
  const thumbnail = clean(body.thumbnail);
  const location = clean(body.location);
  const eventDate = new Date(body.eventDate);

  if (title.length < 3 || title.length > 100) {
    errors.title = 'Title must be between 3 and 100 characters.';
  }
  if (description.length < 20 || description.length > 2000) {
    errors.description = 'Description must be between 20 and 2000 characters.';
  }
  if (!EVENT_TYPES.includes(eventType)) {
    errors.eventType = 'Please choose a valid event type.';
  }
  if (!isHttpUrl(thumbnail)) {
    errors.thumbnail =
      'Thumbnail must be a valid image link starting with http or https.';
  }
  if (location.length < 3 || location.length > 150) {
    errors.location = 'Location must be between 3 and 150 characters.';
  }
  if (!body.eventDate || Number.isNaN(eventDate.getTime())) {
    errors.eventDate = 'Please choose a valid event date.';
  } else if (eventDate.getTime() <= Date.now()) {
    errors.eventDate = 'The event date must be in the future.';
  }

  return {
    errors,
    value: { title, description, eventType, thumbnail, location, eventDate },
  };
}
