import { model, Schema } from "mongoose";

/** A named sequence, e.g. "invoice-2026". */
export interface CounterInterface {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterInterface>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const CounterModel = model<CounterInterface>("Counter", counterSchema);

/** The next number of a sequence, starting at 1. Safe under concurrency. */
export async function nextSequence(name: string): Promise<number> {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  ).exec();
  return counter.seq;
}
