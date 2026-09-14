import { ActorProfile, normalizeAgents } from './profile-types';

describe('normalizeAgents', () => {
  it('fills missing fields on existing agent entries', () => {
    const profile = {
      agents: [
        {
          agencyName: 'CAA',
        },
        {},
      ],
    } as unknown as Partial<ActorProfile>;

    expect(
      normalizeAgents(profile)
    ).toEqual([
      {
        agencyName: 'CAA',
        agencyEmail: '',
        agencyWebsite: '',
        agencyPhone: '',
      },
      {
        agencyName: '',
        agencyEmail: '',
        agencyWebsite: '',
        agencyPhone: '',
      },
    ]);
  });
});
