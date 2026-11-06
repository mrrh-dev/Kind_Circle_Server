import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';

export default function joinsRouter(
  eventsCollection,
  joinsCollection,
  findEventById,
) {
  const router = Router();

  // POST /events/:id/join (private) - saves who joined which event
  router.post('/events/:id/join', verifyToken, async (req, res) => {
    const event = await findEventById(req.params.id);
    if (!event) {
      return res.status(404).send({ message: 'We could not find that event.' });
    }
    if (event.eventDate < new Date()) {
      return res
        .status(400)
        .send({ message: 'This event has already taken place.' });
    }

    try {
      await joinsCollection.insertOne({
        eventId: event._id,
        eventTitle: event.title,
        userEmail: req.user.email,
        userName: req.user.name,
        userPhoto: req.user.image,
        joinedAt: new Date(),
      });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .send({ message: 'You have already joined this event.' });
      }
      throw error;
    }

    // counter for the event
    await eventsCollection.updateOne(
      { _id: event._id },
      { $inc: { participantCount: 1 } },
    );
    res.status(201).send({ message: 'You joined the event. See you there!' });
  });

  // GET /events/:id/membership (private) - did this user already join?
  router.get('/events/:id/membership', verifyToken, async (req, res) => {
    const event = await findEventById(req.params.id);
    const join =
      event &&
      (await joinsCollection.findOne({
        eventId: event._id,
        userEmail: req.user.email,
      }));
    res.send({ joined: Boolean(join) });
  });

  // GET /joined (private) - events the logged-in user joined, earliest first

  router.get('/joined', verifyToken, async (req, res) => {
    const joins = await joinsCollection
      .find({ userEmail: req.user.email })
      .toArray();

    const eventIds = joins.map((join) => join.eventId);
    const events = await eventsCollection
      .find({ _id: { $in: eventIds } })
      .sort({ eventDate: 1 })
      .toArray();

    const joinedEvents = events.map((event) => {
      const join = joins.find((item) => item.eventId.equals(event._id));
      return { joinId: join._id, joinedAt: join.joinedAt, event };
    });

    res.send(joinedEvents);
  });

  return router;
}
