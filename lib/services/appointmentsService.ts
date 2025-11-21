import { apiClient } from "../api/axios";
import { logger } from "../utils/logger";
import type { Appointment } from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface UpcomingAppointmentPayload {
  appointment: Appointment | null | undefined;
}

const mapAppointment = (appointment: any): Appointment => ({
  id: String(appointment.id ?? ""),
  scheduledAt: String(appointment.scheduledAt ?? ""),
  location: appointment.location ?? null,
  notes: appointment.notes ?? null,
  case: {
    id: String(appointment.case?.id ?? ""),
    referenceNumber: String(appointment.case?.referenceNumber ?? ""),
    status: appointment.case?.status ?? "",
  },
  assignedAgent: appointment.assignedAgent
    ? {
        firstName: String(appointment.assignedAgent.firstName ?? ""),
        lastName: String(appointment.assignedAgent.lastName ?? ""),
        email: String(appointment.assignedAgent.email ?? ""),
      }
    : null,
  actionUrl: appointment.actionUrl ?? null,
});

export const appointmentsService = {
  async getUpcoming(): Promise<Appointment | null> {
    try {
      const response = await apiClient.get<
        ApiResponse<UpcomingAppointmentPayload>
      >("/appointments/upcoming");

      const rawAppointment = response.data.data?.appointment;
      if (!rawAppointment) {
        logger.info("Upcoming appointments: none found");
        return null;
      }

      const appointment = mapAppointment(rawAppointment);
      logger.info("Upcoming appointment fetched", {
        appointmentId: appointment.id,
        caseId: appointment.case?.id,
        scheduledAt: appointment.scheduledAt,
      });
      return appointment;
    } catch (error: any) {
      // Handle 404 as "no appointment found" rather than an error
      if (error?.response?.status === 404) {
        logger.info(
          "Upcoming appointments endpoint not found or no appointment available",
        );
        return null;
      }
      // For other errors, log but don't throw - return null gracefully
      logger.warn("Failed to fetch upcoming appointment", {
        status: error?.response?.status,
        message: error?.message,
      });
      return null;
    }
  },
};
