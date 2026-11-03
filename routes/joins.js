import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { verifyToken } from '../middleware/verifyToken.js';
import { eventNotFound, isValidObjectId } from '../utils/validate.js';

export default function joinsRouter(eventsCollection, joinsCollection) {
  const router = Router();

  // POST /events/:id/join  (private) - saves who joined which event
  router.post('/events/:id/join', verifyToken, async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!isValidObjectId(id)) return eventNotFound(res);

      const eventId = new ObjectId(id);
      const event = await eventsCollection.findOne({ _id: eventId });
      if (!event) return eventNotFound(res);

      // You can't join an event that is already happend
      if (new Date(event.eventDate).getTime() < Date.now()) {
        return res
          .status(400)
          .send({ message: 'This event has already taken place.' });
      }

      // Save the event data together with the user data
      await joinsCollection.insertOne({
        eventId,
        eventTitle: event.title,
        userEmail: req.user.email,
        userName: req.user.name,
        userPhoto: req.user.image,
        joinedAt: new Date(),
      });

      res.status(201).send({ message: 'You joined the event. See you there!' });
    } catch (error) {
      // Error code 11000 means "duplicate": the unique index in index.js stops
      // the same person from joining the same event twice
      if (error.code === 11000) {
        return res
          .status(409)
          .send({ message: 'You have already joined this event.' });
      }
      next(error);
    }
  });

  // GET /events/:id/membership  (private route)
  // Tells the details page if this user already joined (then it can change the button)
  router.get('/events/:id/membership', verifyToken, async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!isValidObjectId(id)) {
        return res.send({ joined: false });
      }

      const found = await joinsCollection.findOne({
        eventId: new ObjectId(id),
        userEmail: req.user.email,
      });
      res.send({ joined: Boolean(found) });
    } catch (error) {
      next(error);
    }
  });

  // GET /joined  (private) - events the logged-in user joined, sorted by date
  router.get('/joined', verifyToken, async (req, res, next) => {
    try {
      const rows = await joinsCollection
        .aggregate([
          // 1. Only the joins of this user
          { $match: { userEmail: req.user.email } },

          // 2. Attach the full event data to each join
          {
            $lookup: {
              from: 'events',
              localField: 'eventId',
              foreignField: '_id',
              as: 'event',
            },
          },
          { $unwind: '$event' },

          // 3. Count how many people joined each event
          {
            $lookup: {
              from: 'joins',
              localField: 'eventId',
              foreignField: 'eventId',
              as: 'allJoins',
            },
          },
          { $addFields: { 'event.participantCount': { $size: '$allJoins' } } },
          { $project: { allJoins: 0 } },

          // 4. Earliest event first
          { $sort: { 'event.eventDate': 1 } },
        ])
        .toArray();

      const joinedEvents = rows.map((row) => ({
        joinId: row._id.toString(),
        joinedAt: row.joinedAt,
        event: { ...row.event, _id: row.event._id.toString() },
      }));
      res.send(joinedEvents);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
