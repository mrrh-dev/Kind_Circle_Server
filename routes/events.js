import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { verifyToken } from '../middleware/verifyToken.js';
import {
  EVENT_TYPES,
  escapeRegex,
  eventNotFound,
  isValidObjectId,
  validateEventInput,
} from '../utils/validate.js';

export default function eventsRouter(eventsCollection, joinsCollection) {
  const router = Router();

  // Takes a list of events and adds "participantCount" (how many people joined)
  async function addParticipantCounts(events) {
    if (events.length === 0) return [];

    const eventIds = events.map((event) => event._id);
    const rows = await joinsCollection
      .aggregate([
        { $match: { eventId: { $in: eventIds } } },
        { $group: { _id: '$eventId', count: { $sum: 1 } } },
      ])
      .toArray();

    // Turn the rows into an object like { eventId: count }
    const counts = {};
    rows.forEach((row) => {
      counts[row._id.toString()] = row.count;
    });

    return events.map((event) => ({
      ...event,
      _id: event._id.toString(),
      participantCount: counts[event._id.toString()] || 0,
    }));
  }

  // GET /events  (public)
  // Only upcoming events, soonest first
  router.get('/', async (req, res, next) => {
    try {
      const { type, search } = req.query;
      const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 0, 0),
        60,
      );

      const filter = { eventDate: { $gte: new Date() } };
      if (typeof type === 'string' && EVENT_TYPES.includes(type)) {
        filter.eventType = type;
      }
      if (typeof search === 'string' && search.trim()) {
        const pattern = new RegExp(
          escapeRegex(search.trim().slice(0, 60)),
          'i',
        );
        filter.$or = [{ title: pattern }, { location: pattern }];
      }

      let cursor = eventsCollection.find(filter).sort({ eventDate: 1 });
      if (limit > 0) {
        cursor = cursor.limit(limit);
      }

      const events = await cursor.toArray();
      res.send(await addParticipantCounts(events));
    } catch (error) {
      next(error);
    }
  });

  // GET /events/mine  (private)
  // Note: keep this above "/:id", otherwise express reads "mine" as an id.
  router.get('/mine', verifyToken, async (req, res, next) => {
    try {
      const events = await eventsCollection
        .find({ createdBy: req.user.email })
        .sort({ eventDate: 1 })
        .toArray();
      res.send(await addParticipantCounts(events));
    } catch (error) {
      next(error);
    }
  });

  // GET /events/:id  (public)
  router.get('/:id', async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!isValidObjectId(id)) return eventNotFound(res);

      const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
      if (!event) return eventNotFound(res);

      const [eventWithCount] = await addParticipantCounts([event]);
      res.send(eventWithCount);
    } catch (error) {
      next(error);
    }
  });

  // POST /events  (private)
  // The creator's email comes from the verified token (req.user), never from
  // the request body, so nobody can cheated.
  router.post('/', verifyToken, async (req, res, next) => {
    try {
      const { errors, value } = validateEventInput(req.body);
      if (Object.keys(errors).length > 0) {
        return res
          .status(400)
          .send({ message: 'Please fix the highlighted fields.', errors });
      }

      const newEvent = {
        ...value,
        createdBy: req.user.email,
        creatorName: req.user.name,
        creatorPhoto: req.user.image,
        createdAt: new Date(),
      };

      const result = await eventsCollection.insertOne(newEvent);
      res.status(201).send({
        message: 'Your event is live.',
        event: {
          ...newEvent,
          _id: result.insertedId.toString(),
          participantCount: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // PUT /events/:id  (private) - only the creator can update
  router.put('/:id', verifyToken, async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!isValidObjectId(id)) return eventNotFound(res);

      const query = { _id: new ObjectId(id) };
      const event = await eventsCollection.findOne(query);
      if (!event) return eventNotFound(res);
      if (event.createdBy !== req.user.email) {
        return res
          .status(403)
          .send({ message: 'You can only update events you created.' });
      }

      const { errors, value } = validateEventInput(req.body);
      if (Object.keys(errors).length > 0) {
        return res
          .status(400)
          .send({ message: 'Please fix the highlighted fields.', errors });
      }

      await eventsCollection.updateOne(query, {
        $set: { ...value, updatedAt: new Date() },
      });
      res.send({ message: 'Event updated.' });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /events/:id  (private) - only the creator can delete.
  router.delete('/:id', verifyToken, async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!isValidObjectId(id)) return eventNotFound(res);

      const query = { _id: new ObjectId(id) };
      const event = await eventsCollection.findOne(query);
      if (!event) return eventNotFound(res);
      if (event.createdBy !== req.user.email) {
        return res
          .status(403)
          .send({ message: 'You can only delete events you created.' });
      }

      await eventsCollection.deleteOne(query);
      await joinsCollection.deleteMany({ eventId: query._id });
      res.send({ message: 'Event deleted.' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
