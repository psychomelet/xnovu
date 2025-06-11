const mockSupabaseClient = {
  schema: jest.fn(() => mockSupabaseClient),
  from: jest.fn(() => mockSupabaseClient),
  select: jest.fn(() => mockSupabaseClient),
  insert: jest.fn(() => mockSupabaseClient),
  update: jest.fn(() => mockSupabaseClient),
  eq: jest.fn(() => mockSupabaseClient),
  not: jest.fn(() => mockSupabaseClient),
  lte: jest.fn(() => mockSupabaseClient),
  in: jest.fn(() => mockSupabaseClient),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  then: jest.fn(() => Promise.resolve({ data: [], error: null })),
};

const createClient = jest.fn(() => mockSupabaseClient);

module.exports = {
  createClient,
  __esModule: true,
  default: { createClient },
};