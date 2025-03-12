// Mock the RedisClient to return a dummy connection object
jest.mock("../../src/utils/RedisClient", () => ({
  getInstance: jest.fn(() => ({})), // returns an empty object as dummy connection
}));

// Create a dummy Queue class and mock its add method
const addMock = jest.fn().mockResolvedValue("jobId");
const FakeQueue = jest
  .fn()
  .mockImplementation((queueName: string, options: any) => ({
    queueName,
    options,
    add: addMock,
  }));

// Mock the bullmq module so that Queue is replaced by our FakeQueue
jest.mock("bullmq", () => ({
  Queue: FakeQueue,
}));

import { QueueManager } from "../../src/core/QueueManager";

describe("QueueManager", () => {
  beforeEach(() => {
    // Clear mocks before each test to ensure clean state
    jest.clearAllMocks();
    // Also reset internal static state if needed (e.g., clear the map)
    // (If your implementation doesn't provide a reset method, you might need to add one for testing.)
    // For example: QueueManager.reset();
  });

  it("should create a new queue if it does not exist", () => {
    const queueName = "testQueue";
    const queue = QueueManager.createQueue(queueName);

    expect(queue).toBeDefined();
    expect(FakeQueue).toHaveBeenCalledWith(queueName, { connection: {} });
  });

  it("should return the same queue if already created", () => {
    const queueName = "sameQueue";
    const firstQueue = QueueManager.createQueue(queueName);
    const secondQueue = QueueManager.createQueue(queueName);

    expect(firstQueue).toBe(secondQueue);
    expect(FakeQueue).toHaveBeenCalledTimes(1);
  });

  it("should enqueue a job successfully", async () => {
    const queueName = "enqueueTest";
    const jobName = "jobTest";
    const jobData = { foo: "bar" };

    await QueueManager.enqueueJob(queueName, jobName, jobData);

    // Ensure the queue was created with the dummy connection
    expect(FakeQueue).toHaveBeenCalledWith(queueName, { connection: {} });
    // Verify that the add method was called with the correct parameters
    expect(addMock).toHaveBeenCalledWith(jobName, jobData, {
      removeOnComplete: true,
      removeOnFail: false,
    });
  });
});
