import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';

export default function eventsRouter(
  eventsCollection,
  joinsCollection,
  findEventById,
) {
  const router = Router();

  const EVENT_TYPES = [
    'Cleanup',
    'Plantation',
    'Donation',
    'Food Distribution',
    'Blood Donation',
    'Education',
    'Health Camp',
    'Other',
  ];

  const isEmpty = (value) => typeof value !== 'string' || value.trim() === '';

  // Returns an object of error messages. An empty object means everything is fine.
  function validateEvent(body) {
    const errors = {};
    if (isEmpty(body.title)) errors.title = 'Title is required.';
    if (isEmpty(body.description))
      errors.description = 'Description is required.';
    if (!EVENT_TYPES.includes(body.eventType))
      errors.eventType = 'Please choose a valid event type.';
    if (isEmpty(body.thumbnail))
      errors.thumbnail = 'Thumbnail image link is required.';
    if (isEmpty(body.location)) errors.location = 'Location is required.';
    //catches a missing or invalid date
    if (!(new Date(body.eventDate) > new Date()))
      errors.eventDate = 'The event date must be in the future.';
    return errors;
  }

  // Only these fields are saved, so nobody can sneak in other fields (like createdBy)
  function getEventData(body) {
    return {
      title: body.title,
      description: body.description,
      eventType: body.eventType,
      thumbnail: body.thumbnail,
      location: body.location,
      eventDate: new Date(body.eventDate),
    };
  }

  // GET /events (public) - upcoming events, soonest first
  //
  router.get('/', async (req, res) => {
    const { type, search } = req.query;
    const filter = { eventDate: { $gte: new Date() } };

    if (type) {
      filter.eventType = type;
    }
    if (search) {
      const text = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: text, $options: 'i' } },
        { location: { $regex: text, $options: 'i' } },
      ];
    }

    // limit(0) means "no limit"
    const limit = parseInt(req.query.limit) || 0;
    const events = await eventsCollection
      .find(filter)
      .sort({ eventDate: 1 })
      .limit(limit)
      .toArray();
    res.send(events);
  });

  // GET /events/mine (private) - events created by the logged-in user
  // Keep this above "/:id", otherwise express reads "mine" as an id
  router.get('/mine', verifyToken, async (req, res) => {
    const events = await eventsCollection
      .find({ createdBy: req.user.email })
      .sort({ eventDate: 1 })
      .toArray();
    res.send(events);
  });

  // GET /events/:id (public)
  router.get('/:id', async (req, res) => {
    const event = await findEventById(req.params.id);
    if (!event) {
      return res.status(404).send({ message: 'We could not find that event.' });
    }
    res.send(event);
  });

  // POST /events (private)
  router.post('/', verifyToken, async (req, res) => {
    const errors = validateEvent(req.body);
    if (Object.keys(errors).length > 0) {
      return res
        .status(400)
        .send({ message: 'Please fix the highlighted fields.', errors });
    }

    // The creator comes from the verified token, not from the request body
    const newEvent = {
      ...getEventData(req.body),
      createdBy: req.user.email,
      creatorName: req.user.name,
      creatorPhoto: req.user.image,
      participantCount: 0,
    };
    const result = await eventsCollection.insertOne(newEvent);
    res.status(201).send({
      message: 'Your event is live.',
      event: { ...newEvent, _id: result.insertedId },
    });
  });

  // PUT /events/:id (private) - only the creator can update
  router.put('/:id', verifyToken, async (req, res) => {
    const event = await findEventById(req.params.id);
    if (!event) {
      return res.status(404).send({ message: 'We could not find that event.' });
    }
    if (event.createdBy !== req.user.email) {
      return res
        .status(403)
        .send({ message: 'You can only update events you created.' });
    }

    const errors = validateEvent(req.body);
    if (Object.keys(errors).length > 0) {
      return res
        .status(400)
        .send({ message: 'Please fix the highlighted fields.', errors });
    }

    await eventsCollection.updateOne(
      { _id: event._id },
      { $set: getEventData(req.body) },
    );
    res.send({ message: 'Event updated.' });
  });

  // DELETE /events/:id (private) - only the creator can delete
  router.delete('/:id', verifyToken, async (req, res) => {
    const event = await findEventById(req.params.id);
    if (!event) {
      return res.status(404).send({ message: 'We could not find that event.' });
    }
    if (event.createdBy !== req.user.email) {
      return res
        .status(403)
        .send({ message: 'You can only delete events you created.' });
    }

    await eventsCollection.deleteOne({ _id: event._id });
    await joinsCollection.deleteMany({ eventId: event._id }); // remove its joins too
    res.send({ message: 'Event deleted.' });
  });

  return router;
}
